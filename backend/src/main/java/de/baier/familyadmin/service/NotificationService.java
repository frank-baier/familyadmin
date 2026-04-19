package de.baier.familyadmin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class NotificationService {

    private static final String TEMPLATE_TASK_ASSIGNED   = "task_assigned";
    private static final String TEMPLATE_TASK_REMINDER   = "task_reminder";
    private static final String TEMPLATE_TASK_OVERDUE    = "task_overdue";
    private static final String TEMPLATE_CHECKLIST_DONE  = "checklist_complete";

    @Value("${meta.whatsapp.token}")
    private String accessToken;

    @Value("${meta.whatsapp.phone-number-id}")
    private String phoneNumberId;

    @Value("${app.frontend.url}")
    private String appUrl;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://graph.facebook.com/v19.0")
            .build();

    @Async
    public void sendTaskAssigned(String recipientPhone, String recipientName,
                                 String assignerName, String taskTitle,
                                 String taskId, String dueDate) {
        if (recipientPhone == null || recipientPhone.isBlank()) {
            log.info("Skipping WhatsApp notification for '{}': no phone number set", recipientName);
            return;
        }
        try {
            sendTemplate(recipientPhone, TEMPLATE_TASK_ASSIGNED, List.of(
                    recipientName,
                    assignerName,
                    taskTitle,
                    dueDate != null ? dueDate : "no due date",
                    appUrl + "/tasks/" + taskId
            ));
            log.info("Sent task assignment WhatsApp to {} for task '{}'", recipientPhone, taskTitle);
        } catch (Exception e) {
            log.error("Failed to send task assignment WhatsApp for task '{}': {}", taskId, e.getMessage());
        }
    }

    @Async
    public void sendChecklistComplete(String recipientPhone, String recipientName,
                                      String taskTitle, String taskId) {
        if (recipientPhone == null || recipientPhone.isBlank()) {
            log.info("Skipping checklist-complete WhatsApp for '{}': no phone number set", recipientName);
            return;
        }
        try {
            sendTemplate(recipientPhone, TEMPLATE_CHECKLIST_DONE, List.of(
                    recipientName,
                    taskTitle,
                    appUrl + "/tasks/" + taskId
            ));
            log.info("Sent checklist-complete WhatsApp to {} for task '{}'", recipientPhone, taskTitle);
        } catch (Exception e) {
            log.error("Failed to send checklist-complete WhatsApp for task '{}': {}", taskId, e.getMessage());
        }
    }

    @Async
    public void sendTaskReminder(String recipientPhone, String recipientName,
                                 String taskTitle, String taskId, String dueDate,
                                 boolean isOverdue) {
        if (recipientPhone == null || recipientPhone.isBlank()) {
            log.info("Skipping WhatsApp reminder for '{}': no phone number set", recipientName);
            return;
        }
        try {
            String template = isOverdue ? TEMPLATE_TASK_OVERDUE : TEMPLATE_TASK_REMINDER;
            sendTemplate(recipientPhone, template, List.of(
                    recipientName,
                    taskTitle,
                    dueDate,
                    appUrl + "/tasks/" + taskId
            ));
            log.info("Sent task reminder WhatsApp to {} for task '{}'", recipientPhone, taskTitle);
        } catch (Exception e) {
            log.error("Failed to send task reminder WhatsApp for task '{}': {}", taskId, e.getMessage());
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
                        "language", Map.of("code", "en"),
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
