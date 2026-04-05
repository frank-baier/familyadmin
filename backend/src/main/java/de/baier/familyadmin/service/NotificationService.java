package de.baier.familyadmin.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class NotificationService {

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.whatsapp-from}")
    private String whatsappFrom;

    @Value("${app.frontend.url}")
    private String appUrl;

    @PostConstruct
    public void init() {
        Twilio.init(accountSid, authToken);
    }

    /**
     * Call this while the Hibernate session is still open (inside a @Transactional method)
     * so all lazy associations are resolved before this async method runs in a new thread.
     */
    @Async
    public void sendTaskAssigned(String recipientPhone, String recipientName,
                                 String assignerName, String taskTitle,
                                 String taskId, String dueDate) {
        if (recipientPhone == null || recipientPhone.isBlank()) {
            log.info("Skipping WhatsApp notification for '{}': no phone number set", recipientName);
            return;
        }
        try {
            String body = buildAssignedMessage(recipientName, assignerName, taskTitle, dueDate, taskId);
            send(recipientPhone, body);
            log.info("Sent task assignment WhatsApp to {} for task '{}'", recipientPhone, taskTitle);
        } catch (Exception e) {
            log.error("Failed to send task assignment WhatsApp for task '{}': {}", taskId, e.getMessage());
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
            String body = buildReminderMessage(recipientName, taskTitle, dueDate, isOverdue, taskId);
            send(recipientPhone, body);
            log.info("Sent task reminder WhatsApp to {} for task '{}'", recipientPhone, taskTitle);
        } catch (Exception e) {
            log.error("Failed to send task reminder WhatsApp for task '{}': {}", taskId, e.getMessage());
        }
    }

    private void send(String toPhone, String body) {
        Message.creator(
                new PhoneNumber("whatsapp:" + toPhone),
                new PhoneNumber(whatsappFrom),
                body
        ).create();
    }

    private String buildAssignedMessage(String recipientName, String assignerName,
                                        String taskTitle, String dueDate, String taskId) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(recipientName).append("!\n\n");
        sb.append(assignerName).append(" assigned you a task:\n");
        sb.append("*").append(taskTitle).append("*\n");
        if (dueDate != null) {
            sb.append("Due: ").append(dueDate).append("\n");
        }
        sb.append("\n").append(appUrl).append("/tasks/").append(taskId);
        return sb.toString();
    }

    private String buildReminderMessage(String recipientName, String taskTitle,
                                        String dueDate, boolean isOverdue, String taskId) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(recipientName).append("!\n\n");
        if (isOverdue) {
            sb.append("⚠️ Overdue task:\n");
        } else {
            sb.append("⏰ Task due today:\n");
        }
        sb.append("*").append(taskTitle).append("*\n");
        sb.append("Due: ").append(dueDate).append("\n");
        sb.append("\n").append(appUrl).append("/tasks/").append(taskId);
        return sb.toString();
    }
}
