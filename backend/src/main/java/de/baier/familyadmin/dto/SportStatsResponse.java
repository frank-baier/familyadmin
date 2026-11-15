package de.baier.familyadmin.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Everything the Sport page renders, computed in one pass over the user's activities. */
public record SportStatsResponse(
        Summary summary,
        YearToDate ytd,
        List<YearStat> years,
        List<MonthStat> months,
        List<DayStat> days,
        Fitness fitness,
        List<PersonalRecord> records,
        Consistency consistency,
        List<Insight> insights,
        List<ActivityItem> recent) {

    public record Summary(int activities, double distanceKm, double hours, double elevationM, double calories,
                          LocalDate firstDate, LocalDate lastDate, int activeDays) {}

    public record YearToDate(int year, LocalDate asOf, int count, double distanceKm, double hours,
                             int prevCount, double prevDistanceKm, double prevHours) {}

    public record CategoryTotals(String category, int count, double distanceKm, double hours, double elevationM) {}

    public record YearStat(int year, int count, double distanceKm, double hours, double elevationM, int activeDays,
                           List<CategoryTotals> byCategory) {}

    public record MonthStat(String month, int count, double distanceKm, double hours, double elevationM,
                            List<CategoryTotals> byCategory) {}

    public record DayStat(LocalDate date, int count, double distanceKm, double hours, double load) {}

    public record FitnessPoint(LocalDate date, double fitness, double fatigue, double form) {}

    public record MonthValue(String month, double value, int samples) {}

    public record Intensity(double easyHours, double moderateHours, double hardHours) {}

    public record Fitness(
            int maxHr, boolean maxHrEstimated, int restingHr, boolean restingHrEstimated,
            Integer age, String sex,
            double hrCoverage,
            double currentFitness, double currentFatigue, double currentForm, double rampRate,
            String formStatus,
            double peakFitness, LocalDate peakFitnessDate,
            List<FitnessPoint> series,
            Double vo2max, List<MonthValue> vo2maxTrend,
            List<MonthValue> runEfficiency, List<MonthValue> rideEfficiency,
            Intensity intensity90d) {}

    /** kind: DISTANCE (m), DURATION (s), ELEVATION (m), SPEED (m/s). */
    public record PersonalRecord(String category, String kind, String label, double value,
                                 String activityName, LocalDate date) {}

    public record Consistency(int currentWeekStreak, int longestWeekStreak, LocalDate longestStreakEnd,
                              int[] weekdayCounts, int[] hourCounts, double avgPerWeek12) {}

    /** tone: POSITIVE, NEUTRAL, WARNING. */
    public record Insight(String tone, String title, String text) {}

    public record ActivityItem(String id, String name, String sportType, String category, LocalDateTime start,
                               double distanceKm, double hours, double elevationM, Double avgHr, double load) {}
}
