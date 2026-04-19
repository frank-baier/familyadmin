package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.TaskRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.ChecklistItemRepository;
import de.baier.familyadmin.repository.TaskRepository;
import de.baier.familyadmin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<Task> getAllTasks() {
        return taskRepository.findAllByOrderByDueDateAscCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<Task> getMyTasks(UUID userId) {
        return taskRepository.findByAssigneeIdOrderByDueDateAscCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public Task getTaskById(UUID id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
    }

    public Task createTask(TaskRequest req, User currentUser) {
        User assignee = null;
        if (req.assigneeId() != null) {
            assignee = userRepository.findById(req.assigneeId())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + req.assigneeId()));
        }

        Task task = Task.builder()
                .title(req.title())
                .description(req.description())
                .assignee(assignee)
                .createdBy(currentUser)
                .dueDate(req.dueDate())
                .build();

        if (req.checklistItems() != null) {
            List<ChecklistItem> items = req.checklistItems().stream()
                    .map(i -> ChecklistItem.builder()
                            .task(task)
                            .text(i.text())
                            .position(i.position())
                            .build())
                    .toList();
            task.getChecklistItems().addAll(items);
        }

        Task saved = taskRepository.save(task);
        if (saved.getAssignee() != null) {
            notificationService.sendTaskAssigned(
                    saved.getAssignee().getWhatsappPhone(),
                    saved.getAssignee().getName(),
                    saved.getCreatedBy().getName(),
                    saved.getTitle(),
                    saved.getId().toString(),
                    saved.getDueDate() != null ? saved.getDueDate().toString() : null);
        }
        return saved;
    }

    public Task updateTask(UUID id, TaskRequest req, User currentUser) {
        Task task = getTaskById(id);
        if (currentUser.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only admins can edit tasks");
        }

        UUID previousAssigneeId = task.getAssignee() != null ? task.getAssignee().getId() : null;

        if (req.assigneeId() != null) {
            User assignee = userRepository.findById(req.assigneeId())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + req.assigneeId()));
            task.setAssignee(assignee);
        } else {
            task.setAssignee(null);
        }

        task.setTitle(req.title());
        task.setDescription(req.description());
        task.setDueDate(req.dueDate());

        task.getChecklistItems().clear();
        if (req.checklistItems() != null) {
            req.checklistItems().forEach(i -> task.getChecklistItems().add(
                    ChecklistItem.builder()
                            .task(task)
                            .text(i.text())
                            .position(i.position())
                            .build()));
        }

        Task saved = taskRepository.save(task);
        boolean assigneeChanged = saved.getAssignee() != null
                && !saved.getAssignee().getId().equals(previousAssigneeId);
        if (assigneeChanged) {
            notificationService.sendTaskAssigned(
                    saved.getAssignee().getWhatsappPhone(),
                    saved.getAssignee().getName(),
                    currentUser.getName(),
                    saved.getTitle(),
                    saved.getId().toString(),
                    saved.getDueDate() != null ? saved.getDueDate().toString() : null);
        }
        return saved;
    }

    public Task completeTask(UUID id, User currentUser) {
        Task task = getTaskById(id);
        task.setStatus(TaskStatus.DONE);
        task.setCompletedAt(Instant.now());
        return taskRepository.save(task);
    }

    public ChecklistItem toggleChecklistItem(UUID taskId, UUID itemId) {
        ChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found: " + itemId));
        item.setDone(!item.isDone());
        ChecklistItem saved = checklistItemRepository.save(item);

        Task task = item.getTask();
        boolean allDone = task.getChecklistItems().stream().allMatch(ChecklistItem::isDone);
        if (allDone && !task.getChecklistItems().isEmpty()) {
            String taskTitle = task.getTitle();
            String taskIdStr = task.getId().toString();
            userRepository.findByRole(Role.ADMIN).forEach(admin ->
                    notificationService.sendChecklistComplete(
                            admin.getWhatsappPhone(), admin.getName(), taskTitle, taskIdStr));
        }

        return saved;
    }

    public void deleteTask(UUID id, User currentUser) {
        Task task = getTaskById(id);
        requireOwnerOrAdmin(task, currentUser);
        taskRepository.delete(task);
    }

    private void requireOwnerOrAdmin(Task task, User user) {
        boolean isOwner = task.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You don't have permission to modify this task");
        }
    }
}
