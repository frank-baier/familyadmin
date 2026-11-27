package de.baier.familyadmin.user;

import jakarta.validation.constraints.NotBlank;

public record UpdateProfileRequest(
        @NotBlank String name,
        String whatsappPhone
) {}
