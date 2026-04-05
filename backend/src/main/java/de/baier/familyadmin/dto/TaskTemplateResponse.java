package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.TaskTemplate;
import de.baier.familyadmin.model.TemplateSubtask;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TaskTemplateResponse(
        UUID id,
        String name,
        String description,
        List<SubtaskResponse> subtasks,
        String createdByName,
        Instant createdAt
) {
    public record SubtaskResponse(
            UUID id,
            String text,
            int position
    ) {
        public static SubtaskResponse from(TemplateSubtask s) {
            return new SubtaskResponse(s.getId(), s.getText(), s.getPosition());
        }
    }

    public static TaskTemplateResponse from(TaskTemplate t) {
        return new TaskTemplateResponse(
                t.getId(),
                t.getName(),
                t.getDescription(),
                t.getSubtasks().stream().map(SubtaskResponse::from).toList(),
                t.getCreatedBy().getName(),
                t.getCreatedAt()
        );
    }
}
