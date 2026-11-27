package de.baier.familyadmin.ai;

import de.baier.familyadmin.finance.Portfolio;

import de.baier.familyadmin.user.Role;
import de.baier.familyadmin.user.User;
import de.baier.familyadmin.user.UserRepository;

import com.anthropic.errors.AnthropicServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
* Emails all admins when the Anthropic account has run out of credits — at most once
* per day, so a busy chat doesn't flood the inbox.
*/
@Slf4j
@Service
@RequiredArgsConstructor
public class AnthropicCreditAlertService {

    private static final Duration ALERT_INTERVAL = Duration.ofHours(24);

    private final JavaMailSender mailSender;
    private final UserRepository userRepository;
    private final AtomicReference<Instant> lastAlert = new AtomicReference<>(Instant.EPOCH);

    @Value("${app.mail.from}")
    private String mailFrom;

    /** Anthropic answers HTTP 400 "Your credit balance is too low ..." when the balance is used up. */
    public static boolean isCreditExhausted(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String text = String.valueOf(t.getMessage());
            if (t instanceof AnthropicServiceException ase) {
                text += " " + ase.body();
            } else if (t instanceof RestClientResponseException rce) {
                text += " " + rce.getResponseBodyAsString();
            }
            if (text.toLowerCase().contains("credit balance")) return true;
        }
        return false;
    }

    public void notifyCreditExhausted(String context) {
        Instant now = Instant.now();
        Instant previous = lastAlert.get();
        if (Duration.between(previous, now).compareTo(ALERT_INTERVAL) < 0
                || !lastAlert.compareAndSet(previous, now)) {
            return;
        }
        log.warn("Anthropic credits exhausted ({}) — notifying admins", context);
        for (User admin : userRepository.findByRole(Role.ADMIN)) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(mailFrom);
                msg.setTo(admin.getEmail());
                msg.setSubject("FamilyAdmin: Anthropic-Guthaben aufgebraucht");
                msg.setText("Hallo " + admin.getName() + ",\n\n"
                        + "das Guthaben im Anthropic-Konto ist aufgebraucht (bemerkt bei: " + context + ").\n\n"
                        + "Bis zum Aufladen beantwortet der Dokumenten-Chat Fragen mit dem lokalen Modell "
                        + "(langsamer, schwächer), und die Portfolio-Analyse funktioniert nicht.\n\n"
                        + "Guthaben aufladen: https://console.anthropic.com/settings/billing\n");
                mailSender.send(msg);
            } catch (Exception ex) {
                log.error("Credit alert email to {} failed: {}", admin.getEmail(), ex.getMessage());
            }
        }
    }
}
