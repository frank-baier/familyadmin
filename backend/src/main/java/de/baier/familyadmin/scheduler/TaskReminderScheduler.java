package de.baier.familyadmin.scheduler;

import de.baier.familyadmin.model.Task;
import de.baier.familyadmin.model.TaskStatus;
import de.baier.familyadmin.repository.TaskRepository;
import de.baier.familyadmin.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class TaskReminderScheduler {

    private final TaskRepository taskRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional(readOnly = true)
    public void sendDailyReminders() {
        List<Task> dueTasks = taskRepository.findByStatusNotAndDueDateLessThanEqual(
                TaskStatus.DONE, LocalDate.now());

        log.info("Sending reminders for {} tasks", dueTasks.size());

        for (Task task : dueTasks) {
            if (task.getAssignee() == null || task.getStatus() == TaskStatus.DONE) continue;
            LocalDate dueDate = task.getDueDate();
            boolean isOverdue = dueDate != null && dueDate.isBefore(LocalDate.now());
            notificationService.sendTaskReminder(
                    task.getAssignee().getEmail(),
                    task.getAssignee().getName(),
                    task.getTitle(),
                    task.getId().toString(),
                    dueDate != null ? dueDate.toString() : "No due date",
                    isOverdue);
        }
    }
}
