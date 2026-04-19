package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateProfileRequest(
        @NotBlank String name,
        String whatsappPhone
) {}
