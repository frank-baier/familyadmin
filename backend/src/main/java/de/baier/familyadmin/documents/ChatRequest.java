package de.baier.familyadmin.documents;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(@NotBlank String question) {}
