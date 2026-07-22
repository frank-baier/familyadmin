package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record NoteNodeRequest(
        UUID parentId,
        @NotBlank @Size(max = 255) String name,
        String content
) {}
