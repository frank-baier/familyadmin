package de.baier.familyadmin.travel;

import jakarta.validation.constraints.NotBlank;

public record PackingItemRequest(
        @NotBlank String label,
        boolean personal,
        String category,
        int position
) {}
