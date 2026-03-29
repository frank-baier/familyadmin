package de.baier.familyadmin.service;

import de.baier.familyadmin.model.Task;
import de.baier.familyadmin.model.TaskStatus;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    @Value("${app.frontend.url}")
    private String appUrl;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Async
    public void sendTaskReminder(Task task) {
        if (task.getAssignee() == null) {
            log.debug("Skipping reminder for task '{}': no assignee", task.getId());
            return;
        }
        if (task.getStatus() == TaskStatus.DONE) {
            log.debug("Skipping reminder for task '{}': task is DONE", task.getId());
            return;
        }

        try {
            String recipientEmail = task.getAssignee().getEmail();
            String recipientName = task.getAssignee().getName();
            LocalDate dueDate = task.getDueDate();
            boolean isOverdue = dueDate != null && dueDate.isBefore(LocalDate.now());

            Context ctx = new Context();
            ctx.setVariable("userName", recipientName);
            ctx.setVariable("taskTitle", task.getTitle());
            ctx.setVariable("dueDate", dueDate != null ? dueDate.toString() : "No due date");
            ctx.setVariable("isOverdue", isOverdue);
            ctx.setVariable("taskUrl", appUrl + "/tasks/" + task.getId());

            String htmlBody = templateEngine.process("email/task-reminder", ctx);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(recipientEmail);
            helper.setSubject("Reminder: " + task.getTitle() + (isOverdue ? " is overdue" : " is due today"));
            helper.setText(htmlBody, true);

            mailSender.send(message);
            log.info("Sent task reminder to {} for task '{}'", recipientEmail, task.getTitle());

        } catch (MessagingException e) {
            log.error("Failed to send task reminder for task '{}': {}", task.getId(), e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error sending task reminder for task '{}': {}", task.getId(), e.getMessage());
        }
    }
}
