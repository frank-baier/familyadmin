package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record ItineraryEntryRequest(
        @NotNull LocalDate entryDate,
        LocalTime entryTime,
        @NotBlank String title,
        String description,
        String location,
        int position
) {}
