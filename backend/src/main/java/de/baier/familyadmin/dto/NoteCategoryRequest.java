package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NoteCategoryRequest(
        @NotBlank @Size(max = 100) String name
) {}
