package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.TaskTemplateRequest;
import de.baier.familyadmin.dto.UseTemplateRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.TaskRepository;
import de.baier.familyadmin.repository.TaskTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskTemplateService {

    private final TaskTemplateRepository templateRepository;
    private final TaskRepository taskRepository;

    @Transactional(readOnly = true)
    public List<TaskTemplate> getAll() {
        return templateRepository.findAllByOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public TaskTemplate getById(UUID id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found: " + id));
    }

    public TaskTemplate create(TaskTemplateRequest req, User currentUser) {
        TaskTemplate template = TaskTemplate.builder()
                .name(req.name())
                .description(req.description())
                .createdBy(currentUser)
                .build();

        if (req.subtasks() != null) {
            req.subtasks().forEach(s -> template.getSubtasks().add(
                    TemplateSubtask.builder()
                            .template(template)
                            .text(s.text())
                            .position(s.position())
                            .build()));
        }

        return templateRepository.save(template);
    }

    public TaskTemplate update(UUID id, TaskTemplateRequest req) {
        TaskTemplate template = getById(id);
        template.setName(req.name());
        template.setDescription(req.description());

        template.getSubtasks().clear();
        if (req.subtasks() != null) {
            req.subtasks().forEach(s -> template.getSubtasks().add(
                    TemplateSubtask.builder()
                            .template(template)
                            .text(s.text())
                            .position(s.position())
                            .build()));
        }

        return templateRepository.save(template);
    }

    public void delete(UUID id) {
        TaskTemplate template = getById(id);
        templateRepository.delete(template);
    }

    /** Creates a new task from a template using only the selected subtasks. */
    public Task useTemplate(UUID templateId, UseTemplateRequest req, User currentUser) {
        TaskTemplate template = getById(templateId);

        Set<UUID> selectedIds = req.selectedSubtaskIds() != null
                ? Set.copyOf(req.selectedSubtaskIds())
                : Set.of();

        Task task = Task.builder()
                .title(template.getName())
                .description(template.getDescription())
                .createdBy(currentUser)
                .build();

        List<TemplateSubtask> selected = template.getSubtasks().stream()
                .filter(s -> selectedIds.contains(s.getId()))
                .sorted((a, b) -> Integer.compare(a.getPosition(), b.getPosition()))
                .toList();

        for (int i = 0; i < selected.size(); i++) {
            TemplateSubtask s = selected.get(i);
            task.getChecklistItems().add(
                    ChecklistItem.builder()
                            .task(task)
                            .text(s.getText())
                            .position(i)
                            .build());
        }

        return taskRepository.save(task);
    }
}
