package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record PackingItemRequest(
        @NotBlank String name,
        int position,
        UUID ownerId  // null = shared item
) {}
