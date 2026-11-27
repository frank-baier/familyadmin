package de.baier.familyadmin.sport;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

public record SportProfileDto(
        @Min(100) @Max(240) Integer maxHeartRate,
        @Min(25) @Max(120) Integer restingHeartRate,
        @Min(1900) @Max(2100) Integer birthYear,
        @Pattern(regexp = "MALE|FEMALE") String sex) {}
