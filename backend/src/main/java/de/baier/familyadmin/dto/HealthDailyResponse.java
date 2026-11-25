package de.baier.familyadmin.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Daily Apple Health values plus the state of the user's sync token. */
public record HealthDailyResponse(List<Day> days, Instant lastSyncAt) {
    public record Day(LocalDate date, Map<String, Double> metrics) {}
}
