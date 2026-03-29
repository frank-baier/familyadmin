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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final UserRepository userRepository;

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

        return taskRepository.save(task);
    }

    public Task updateTask(UUID id, TaskRequest req, User currentUser) {
        Task task = getTaskById(id);
        requireOwnerOrAdmin(task, currentUser);

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

        return taskRepository.save(task);
    }

    public Task completeTask(UUID id, User currentUser) {
        Task task = getTaskById(id);
        task.setStatus(TaskStatus.DONE);
        task.setCompletedAt(OffsetDateTime.now());
        return taskRepository.save(task);
    }

    public ChecklistItem toggleChecklistItem(UUID taskId, UUID itemId) {
        ChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Checklist item not found: " + itemId));
        item.setDone(!item.isDone());
        return checklistItemRepository.save(item);
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
