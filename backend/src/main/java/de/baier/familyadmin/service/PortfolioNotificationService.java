package de.baier.familyadmin.service;

import de.baier.familyadmin.model.Portfolio;
import de.baier.familyadmin.model.PortfolioAnalysis;
import de.baier.familyadmin.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Delivers a finished portfolio analysis by email to the portfolio owner.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioNotificationService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String mailFrom;

    @Value("${app.frontend.url}")
    private String appUrl;

    @Async
    public void notifyAnalysisReady(Portfolio portfolio, PortfolioAnalysis analysis) {
        String portfolioUrl = appUrl + "/finance/" + portfolio.getId();
        sendEmail(portfolio.getCreatedBy(), portfolio, analysis, portfolioUrl);
    }

    private void sendEmail(User recipient, Portfolio portfolio, PortfolioAnalysis analysis, String portfolioUrl) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(mailFrom);
            msg.setTo(recipient.getEmail());
            msg.setSubject("Portfolio-Analyse: " + portfolio.getName());
            msg.setText("Hallo " + recipient.getName() + ",\n\n"
                    + "eine neue Analyse für dein Portfolio \"" + portfolio.getName() + "\" ist verfügbar:\n\n"
                    + analysis.getContent() + "\n\n" + portfolioUrl);
            mailSender.send(msg);
            log.info("Portfolio analysis email sent to {} for portfolio {}", recipient.getEmail(), portfolio.getId());
        } catch (Exception e) {
            log.error("Portfolio analysis email failed for {}: {}", recipient.getEmail(), e.getMessage());
        }
    }
}
