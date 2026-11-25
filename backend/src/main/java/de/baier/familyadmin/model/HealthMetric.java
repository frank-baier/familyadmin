package de.baier.familyadmin.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * Whitelisted Apple Health daily metrics. The JSON key is what the iOS Shortcut sends;
 * min/max reject obviously broken values (e.g. a resting HR of 0 when the watch wasn't worn).
 */
public enum HealthMetric {
    STEPS("steps", 0, 150_000),
    WALKING_DISTANCE_KM("walking_distance_km", 0, 200),
    ACTIVE_ENERGY_KCAL("active_energy_kcal", 0, 10_000),
    EXERCISE_MINUTES("exercise_minutes", 0, 1_440),
    FLIGHTS_CLIMBED("flights_climbed", 0, 1_000),
    RESTING_HR("resting_hr", 25, 150),
    HRV_MS("hrv_ms", 1, 300),
    VO2MAX("vo2max", 10, 100),
    SLEEP_HOURS("sleep_hours", 0.1, 24),
    WEIGHT_KG("weight_kg", 20, 300),
    BODY_FAT_PCT("body_fat_pct", 2, 70);

    public final String key;
    public final double min;
    public final double max;

    HealthMetric(String key, double min, double max) {
        this.key = key;
        this.min = min;
        this.max = max;
    }

    public static Optional<HealthMetric> fromKey(String key) {
        return Arrays.stream(values()).filter(m -> m.key.equalsIgnoreCase(key)).findFirst();
    }
}
