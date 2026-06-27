package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(@NotBlank String question) {}
