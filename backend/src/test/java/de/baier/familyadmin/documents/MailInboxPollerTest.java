package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.UserRepository;

import jakarta.activation.DataHandler;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MailInboxPollerTest {

    @Test
    void onlyRealAttachmentsAreCollected() throws Exception {
        MimeMessage msg = new MimeMessage(Session.getInstance(new Properties()));
        MimeMultipart related = new MimeMultipart("related");
        MimeBodyPart html = new MimeBodyPart();
        html.setText("<p>Hallo <img src=\"cid:logo\"></p>", "utf-8", "html");
        related.addBodyPart(html);
        related.addBodyPart(part("logo.png", "image/png", Part.INLINE, "<logo>"));

        MimeMultipart mixed = new MimeMultipart("mixed");
        MimeBodyPart relatedWrapper = new MimeBodyPart();
        relatedWrapper.setContent(related);
        mixed.addBodyPart(relatedWrapper);
        mixed.addBodyPart(part("=?UTF-8?Q?Rechnung_M=C3=A4rz.pdf?=", "application/pdf", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("smime.p7s", "application/pkcs7-signature", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("einladung.ics", "text/calendar", Part.ATTACHMENT, null));
        mixed.addBodyPart(part("foto.jpg", "image/jpeg", Part.ATTACHMENT, null));
        msg.setContent(mixed);
        msg.saveChanges();

        MailInboxPoller poller = new MailInboxPoller(mock(ScanInboxService.class), mock(ScanInboxAnalyzer.class),
                mock(UserRepository.class), mock(JdbcTemplate.class));
        List<Part> found = new ArrayList<>();
        poller.collectAttachments(new MimeMessage(msg), found, 0);

        assertThat(found).extracting(Part::getFileName)
                .containsExactly("=?UTF-8?Q?Rechnung_M=C3=A4rz.pdf?=", "foto.jpg");
    }

    private static MimeBodyPart part(String filename, String type, String disposition, String cid) throws Exception {
        MimeBodyPart p = new MimeBodyPart();
        p.setDataHandler(new DataHandler(new ByteArrayDataSource(new byte[]{1, 2, 3}, type)));
        p.setFileName(filename);
        p.setDisposition(disposition);
        if (cid != null) p.setContentID(cid);
        return p;
    }
}
