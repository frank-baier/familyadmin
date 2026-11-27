package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;
import de.baier.familyadmin.user.UserRepository;

import jakarta.mail.*;
import jakarta.mail.internet.ContentType;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimePart;
import jakarta.mail.internet.MimeUtility;
import jakarta.mail.search.ComparisonTerm;
import jakarta.mail.search.ReceivedDateTerm;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Polls the configured IMAP mailbox READ-ONLY (nothing is marked as read, moved or
 * deleted) and turns new attachments into {@link MailInboxItem}s with a filing suggestion.
 * Progress is tracked by IMAP UID, so each mail is looked at once.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MailInboxPoller {

    private static final long MAX_ATTACHMENT_BYTES = 25L * 1024 * 1024;
    /** Smaller images are almost always signature logos or tracking pixels. */
    private static final long MIN_IMAGE_BYTES = 30L * 1024;
    private static final Set<String> SKIPPED_EXTENSIONS = Set.of(
            "p7s", "p7m", "asc", "sig", "vcf", "ics", "htm", "html", "eml", "gif");
    private static final Set<String> DOCUMENT_EXTENSIONS = Set.of(
            "pdf", "jpg", "jpeg", "png", "heic", "tif", "tiff", "doc", "docx", "xls", "xlsx",
            "odt", "ods", "txt", "csv", "zip");
    private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");

    private final MailInboxItemRepository itemRepository;
    private final MailFilingSuggestionService suggestionService;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    private final ReentrantLock lock = new ReentrantLock();

    @Value("${app.mail-inbox.host:imap.gmx.net}") private String host;
    @Value("${app.mail-inbox.port:993}") private int port;
    @Value("${app.mail-inbox.username:}") private String username;
    @Value("${app.mail-inbox.password:}") private String password;
    @Value("${app.mail-inbox.folder:INBOX}") private String folderName;
    @Value("${app.mail-inbox.owner-email:}") private String ownerEmail;
    @Value("${app.mail-inbox.initial-lookback-days:14}") private int lookbackDays;

    public boolean isConfigured() {
        return StringUtils.hasText(username) && StringUtils.hasText(password);
    }

    @Scheduled(fixedDelayString = "${app.mail-inbox.poll-interval-ms:600000}", initialDelay = 120_000)
    public void scheduledPoll() {
        if (!isConfigured()) return;
        try {
            poll();
        } catch (Exception e) {
            log.error("Mail inbox poll failed: {}", e.getMessage());
        }
    }

    /** Fetches new mails; returns the number of new inbox items, or -1 if a poll is already running. */
    public int poll() throws MessagingException {
        if (!isConfigured()) throw new IllegalStateException("Mail-Posteingang ist nicht konfiguriert");
        if (!lock.tryLock()) return -1;
        try {
            User owner = userRepository.findByEmail(ownerEmail)
                    .orElseThrow(() -> new IllegalStateException("Owner user not found: " + ownerEmail));
            return doPoll(owner);
        } finally {
            lock.unlock();
        }
    }

    private int doPoll(User owner) throws MessagingException {
        Properties props = new Properties();
        props.put("mail.store.protocol", "imaps");
        props.put("mail.imaps.ssl.checkserveridentity", "true");
        props.put("mail.imaps.connectiontimeout", "20000");
        props.put("mail.imaps.timeout", "60000");
        Session session = Session.getInstance(props);

        String account = username + "@" + host + "/" + folderName;
        int created = 0;
        try (Store store = session.getStore("imaps")) {
            store.connect(host, port, username, password);
            Folder folder = store.getFolder(folderName);
            folder.open(Folder.READ_ONLY);
            try {
                UIDFolder uids = (UIDFolder) folder;
                long validity = uids.getUIDValidity();
                long uidNext = uids.getUIDNext();
                boolean knowsUidNext = uidNext > 0;
                if (!knowsUidNext) uidNext = Long.MAX_VALUE;
                long[] state = loadState(account);

                Message[] messages;
                long lastUid;
                if (state == null || state[0] != validity) {
                    Date since = Date.from(Instant.now().minus(lookbackDays, ChronoUnit.DAYS));
                    messages = folder.search(new ReceivedDateTerm(ComparisonTerm.GE, since));
                    lastUid = 0;
                    log.info("Mail inbox: first scan of {} — {} mail(s) from the last {} days",
                            account, messages.length, lookbackDays);
                } else {
                    lastUid = state[1];
                    messages = uidNext > lastUid + 1
                            ? uids.getMessagesByUID(lastUid + 1, UIDFolder.LASTUID)
                            : new Message[0];
                }

                FetchProfile fp = new FetchProfile();
                fp.add(FetchProfile.Item.ENVELOPE);
                fp.add(FetchProfile.Item.CONTENT_INFO);
                fp.add(UIDFolder.FetchProfileItem.UID);
                folder.fetch(messages, fp);

                long maxUid = lastUid;
                for (Message m : messages) {
                    long uid = uids.getUID(m);
                    // "n:*" always returns the newest mail, even if it is older than n.
                    if (uid <= lastUid || uid >= uidNext) continue;
                    try {
                        created += processMessage(m, uid, validity, owner);
                    } catch (Exception e) {
                        log.error("Mail inbox: could not process mail UID {}: {}", uid, e.getMessage());
                    }
                    maxUid = Math.max(maxUid, uid);
                }
                saveState(account, validity, knowsUidNext ? Math.max(maxUid, uidNext - 1) : maxUid);
            } finally {
                folder.close(false);
            }
        }
        if (created > 0) log.info("Mail inbox: {} new attachment(s) waiting for review", created);
        return created;
    }

    private int processMessage(Message m, long uid, long validity, User owner) throws Exception {
        String[] ids = m.getHeader("Message-ID");
        String messageId = ids != null && ids.length > 0 && StringUtils.hasText(ids[0])
                ? ids[0].strip() : "uid:" + validity + ":" + uid;
        if (messageId.length() > 998) messageId = messageId.substring(0, 998);
        if (itemRepository.existsByOwnerIdAndMessageId(owner.getId(), messageId)) return 0;

        List<Part> attachments = new ArrayList<>();
        collectAttachments(m, attachments, 0);
        if (attachments.isEmpty()) return 0;

        String from = formatFrom(m.getFrom());
        String subject = truncate(m.getSubject(), 998);
        Date received = m.getReceivedDate() != null ? m.getReceivedDate() : m.getSentDate();
        Instant mailDate = received != null ? received.toInstant() : Instant.now();
        LocalDate mailDay = mailDate.atZone(ZONE).toLocalDate();

        int index = 0;
        int created = 0;
        for (Part part : attachments) {
            index++;
            byte[] data;
            try (InputStream in = part.getInputStream()) {
                data = in.readNBytes((int) MAX_ATTACHMENT_BYTES + 1);
            }
            if (data.length > MAX_ATTACHMENT_BYTES) continue;
            String filename = truncate(decodedFilename(part), 255);
            if (isImage(part, filename) && data.length < MIN_IMAGE_BYTES) continue;

            MailFilingSuggestionService.Suggestion s = null;
            try {
                s = suggestionService.suggest(owner.getId(), filename, data, from, subject, mailDay);
            } catch (Exception e) {
                log.warn("Mail inbox: no suggestion for '{}': {}", filename, e.getMessage());
            }

            itemRepository.save(MailInboxItem.builder()
                    .owner(owner)
                    .messageId(messageId)
                    .attachmentIndex(index)
                    .mailFrom(truncate(from, 512))
                    .mailSubject(subject)
                    .mailDate(mailDate)
                    .filename(filename)
                    .contentType(contentType(part, filename))
                    .fileSize(data.length)
                    .data(data)
                    .suggestedCategory(s != null ? truncate(s.category(), 255) : null)
                    .suggestedSubcategory(s != null ? truncate(s.subcategory(), 255) : null)
                    .suggestedYear(s != null && s.year() != null ? s.year() : mailDay.getYear())
                    .suggestionReason(s != null ? s.reason() : null)
                    .suggestedImportant(s != null ? s.important() : null)
                    .suggestionModel(s != null ? s.model() : null)
                    .build());
            created++;
        }
        return created;
    }

    void collectAttachments(Part part, List<Part> out, int depth) throws Exception {
        if (depth > 10) return;
        if (part.isMimeType("multipart/*")) {
            Multipart mp = (Multipart) part.getContent();
            for (int i = 0; i < mp.getCount(); i++) {
                collectAttachments(mp.getBodyPart(i), out, depth + 1);
            }
            return;
        }
        if (part.isMimeType("message/rfc822")) {
            // Forwarded mail: its attachments count too.
            collectAttachments((Part) part.getContent(), out, depth + 1);
            return;
        }
        String filename = decodedFilename(part);
        if (filename == null) return;
        String ext = extension(filename);
        if (SKIPPED_EXTENSIONS.contains(ext)) return;
        if (!DOCUMENT_EXTENSIONS.contains(ext) && !part.isMimeType("application/pdf")) return;
        // Inline images referenced by the HTML body (Content-ID) are logos/signatures.
        boolean inline = Part.INLINE.equalsIgnoreCase(part.getDisposition());
        if (inline && isImage(part, filename) && part instanceof MimePart mp && mp.getContentID() != null) return;
        out.add(part);
    }

    private static String decodedFilename(Part part) throws MessagingException {
        String name = part.getFileName();
        if (!StringUtils.hasText(name)) return null;
        try {
            return MimeUtility.decodeText(name).strip();
        } catch (Exception e) {
            return name.strip();
        }
    }

    private static boolean isImage(Part part, String filename) throws MessagingException {
        String ext = filename != null ? extension(filename) : "";
        return part.isMimeType("image/*") || Set.of("jpg", "jpeg", "png", "heic", "tif", "tiff").contains(ext);
    }

    private static String contentType(Part part, String filename) throws MessagingException {
        String base = "application/octet-stream";
        try {
            base = new ContentType(part.getContentType()).getBaseType().toLowerCase(Locale.ROOT);
        } catch (Exception ignored) {
        }
        if (!"application/octet-stream".equals(base)) return base;
        return switch (extension(filename)) {
            case "pdf" -> "application/pdf";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "heic" -> "image/heic";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            default -> base;
        };
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private static String formatFrom(Address[] from) {
        if (from == null || from.length == 0) return null;
        if (from[0] instanceof InternetAddress ia) {
            return StringUtils.hasText(ia.getPersonal())
                    ? ia.getPersonal() + " <" + ia.getAddress() + ">" : ia.getAddress();
        }
        return from[0].toString();
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private long[] loadState(String account) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT uid_validity, last_uid FROM mail_inbox_sync_state WHERE account = ?",
                    (rs, n) -> new long[]{rs.getLong(1), rs.getLong(2)}, account);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private void saveState(String account, long validity, long lastUid) {
        jdbcTemplate.update("""
                INSERT INTO mail_inbox_sync_state (account, uid_validity, last_uid, updated_at)
                VALUES (?, ?, ?, now())
                ON CONFLICT (account) DO UPDATE
                   SET uid_validity = EXCLUDED.uid_validity, last_uid = EXCLUDED.last_uid, updated_at = now()
                """, account, validity, lastUid);
    }
}
