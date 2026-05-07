package de.baier.familyadmin.service;

import de.baier.familyadmin.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final String TEMPLATE_TASK_ASSIGNED  = "task_assigned";
    private static final String TEMPLATE_TASK_REMINDER  = "task_reminder";
    private static final String TEMPLATE_TASK_OVERDUE   = "task_overdue";
    private static final String TEMPLATE_CHECKLIST_DONE = "checklist_complete";

    private final JavaMailSender mailSender;

    @Value("${meta.whatsapp.token}")
    private String accessToken;

    @Value("${meta.whatsapp.phone-number-id}")
    private String phoneNumberId;

    @Value("${app.frontend.url}")
    private String appUrl;

    @Value("${app.mail.from}")
    private String mailFrom;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://graph.facebook.com/v19.0")
            .build();

    @Async
    public void sendTaskAssigned(User recipient, String assignerName,
                                 String taskTitle, String taskId, String dueDate) {
        String taskUrl = appUrl + "/tasks/" + taskId;
        String dueDateStr = dueDate != null ? dueDate : "kein Fälligkeitsdatum";

        sendWhatsApp(recipient, TEMPLATE_TASK_ASSIGNED,
                List.of(recipient.getName(), assignerName, taskTitle, dueDateStr, taskUrl));

        sendEmail(recipient.getEmail(),
                "Neue Aufgabe: " + taskTitle,
                "Hallo " + recipient.getName() + ",\n\n" +
                assignerName + " hat dir eine neue Aufgabe zugewiesen:\n\n" +
                "Aufgabe: " + taskTitle + "\n" +
                "Fällig: " + dueDateStr + "\n\n" +
                taskUrl);
    }

    @Async
    public void sendChecklistComplete(User recipient, String taskTitle, String taskId) {
        String taskUrl = appUrl + "/tasks/" + taskId;

        sendWhatsApp(recipient, TEMPLATE_CHECKLIST_DONE,
                List.of(recipient.getName(), taskTitle, taskUrl));

        sendEmail(recipient.getEmail(),
                "Checkliste abgeschlossen: " + taskTitle,
                "Hallo " + recipient.getName() + ",\n\n" +
                "Alle Checklistenpunkte der Aufgabe \"" + taskTitle + "\" wurden erledigt.\n\n" +
                taskUrl);
    }

    @Async
    public void sendTaskReminder(User recipient, String taskTitle,
                                 String taskId, String dueDate, boolean isOverdue) {
        String taskUrl = appUrl + "/tasks/" + taskId;
        String template = isOverdue ? TEMPLATE_TASK_OVERDUE : TEMPLATE_TASK_REMINDER;

        sendWhatsApp(recipient, template,
                List.of(recipient.getName(), taskTitle, dueDate, taskUrl));

        String subject = isOverdue ? "Überfällig: " + taskTitle : "Erinnerung: " + taskTitle;
        String intro = isOverdue
                ? "Hallo " + recipient.getName() + ",\n\ndie folgende Aufgabe ist überfällig:\n\n"
                : "Hallo " + recipient.getName() + ",\n\nErinnerung an folgende Aufgabe:\n\n";
        sendEmail(recipient.getEmail(), subject,
                intro + "Aufgabe: " + taskTitle + "\nFällig: " + dueDate + "\n\n" + taskUrl);
    }

    private void sendWhatsApp(User recipient, String templateName, List<String> params) {
        if (!StringUtils.hasText(recipient.getWhatsappPhone())) {
            log.info("Skipping WhatsApp for '{}': no phone number set", recipient.getName());
            return;
        }
        try {
            sendTemplate(recipient.getWhatsappPhone(), templateName, params);
            log.info("WhatsApp sent to {} for template '{}'", recipient.getName(), templateName);
        } catch (Exception e) {
            log.error("WhatsApp failed for {} ({}): {}", recipient.getName(), templateName, e.getMessage());
        }
    }

    private void sendEmail(String to, String subject, String text) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(mailFrom);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(text);
            mailSender.send(msg);
            log.info("Email sent to {} — {}", to, subject);
        } catch (Exception e) {
            log.error("Email failed to {}: {}", to, e.getMessage());
        }
    }

    private void sendTemplate(String phone, String templateName, List<String> params) {
        List<Map<String, String>> parameters = params.stream()
                .map(p -> Map.of("type", "text", "text", p))
                .toList();

        Map<String, Object> body = Map.of(
                "messaging_product", "whatsapp",
                "to", phone.startsWith("+") ? phone.substring(1) : phone,
                "type", "template",
                "template", Map.of(
                        "name", templateName,
                        "language", Map.of("code", "de"),
                        "components", List.of(
                                Map.of("type", "body", "parameters", parameters)
                        )
                )
        );

        restClient.post()
                .uri("/{phoneNumberId}/messages", phoneNumberId)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }
}
