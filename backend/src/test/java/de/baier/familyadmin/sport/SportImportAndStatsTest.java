package de.baier.familyadmin.sport;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

class SportImportAndStatsTest {

    // Shape of a real Strava activities.csv: duplicated column names, km first / metres later.
    private static final String HEADER = "﻿Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,"
            + "Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,"
            + "Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,"
            + "Elevation Loss,Max Heart Rate,Average Heart Rate,Max Watts,Average Watts,Calories,Relative Effort,Commute\n";

    private final StravaExportParser parser = new StravaExportParser();

    @Test
    void parsesStravaCsvWithDuplicateColumnsAndMultilineDescription() throws Exception {
        String csv = HEADER
                + "123,\"Mar 15, 2021, 6:02:55 PM\",Abendlauf,Run,\"Schön, \"\"locker\"\"\nzweite Zeile\",3000,10.02,178,55,false,,,,"
                + "75,,3000,2900,10020.5,4.8,3.455,85,80,178,152,,,650,55,0\n"
                + "456,\"Mar 16, 2021, 7:00:00 AM\",Pendeln,Ride,,1800,12.5,,,true,,,,,,1800,1700,12500,11,7.35,40,40,,,,,,,1\n";
        var result = parser.parseCsv(new StringReader(csv));

        assertThat(result.warnings()).isEmpty();
        assertThat(result.activities()).hasSize(2);
        var run = result.activities().get(0);
        assertThat(run.externalId()).isEqualTo("123");
        assertThat(run.startTime()).isEqualTo(Instant.parse("2021-03-15T18:02:55Z"));
        assertThat(run.distanceM()).isEqualTo(10020.5);   // metres column preferred over km column
        assertThat(run.movingSeconds()).isEqualTo(2900);
        assertThat(run.avgHeartRate()).isEqualTo(152.0);
        assertThat(run.maxHeartRate()).isEqualTo(178.0);
        assertThat(run.avgSpeedMps()).isEqualTo(3.455);
        assertThat(run.commute()).isFalse();
        var ride = result.activities().get(1);
        assertThat(ride.commute()).isTrue();
        assertThat(ride.avgHeartRate()).isNull();
    }

    @Test
    void findsActivitiesCsvInsideExportZip() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("profile.csv"));
            zip.write("x\n".getBytes(StandardCharsets.UTF_8));
            zip.putNextEntry(new ZipEntry("export_42/activities.csv"));
            zip.write((HEADER + "1,\"Jan 2, 2024, 8:00:00 AM\",Lauf,Run,,1800,5,,,false,,,,,,1800,1800,5000,,,,,,,,,,,\n")
                    .getBytes(StandardCharsets.UTF_8));
        }
        var result = parser.parse(new ByteArrayInputStream(bytes.toByteArray()), "export_42.zip");
        assertThat(result.activities()).hasSize(1);
        assertThat(result.activities().get(0).distanceM()).isEqualTo(5000.0);
    }

    @Test
    void computesPlausibleFitnessFromRegularTraining() {
        LocalDate today = LocalDate.of(2026, 11, 15);
        List<SportActivity> acts = new ArrayList<>();
        // 1 year of 3 runs/week: 10 km in 55 min at 150 bpm
        for (LocalDate d = today.minusDays(365); !d.isAfter(today); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue();
            if (dow != 2 && dow != 4 && dow != 7) continue;
            acts.add(SportActivity.builder().externalId(d.toString()).sportType("Run").name("Lauf")
                    .startTime(d.atTime(7, 30).toInstant(ZoneOffset.UTC))
                    .movingSeconds(55 * 60).elapsedSeconds(57 * 60).distanceM(10000.0).elevationGainM(60.0)
                    .avgHeartRate(150.0).maxHeartRate(182.0).avgSpeedMps(10000.0 / (55 * 60)).build());
        }

        SportStatsResponse stats = new SportStatsService().compute(acts, null, today);

        assertThat(stats.summary().activities()).isEqualTo(acts.size());
        assertThat(stats.fitness().maxHr()).isEqualTo(182);
        // ~3×TRIMP(~90)/7 ≈ 38–40 steady-state fitness
        assertThat(stats.fitness().currentFitness()).isBetween(30.0, 50.0);
        // 10 km in 55 min at ~74 % HRR → VO2max around 50 (ACSM / Swain)
        assertThat(stats.fitness().vo2max()).isBetween(42.0, 58.0);
        assertThat(stats.consistency().currentWeekStreak()).isGreaterThanOrEqualTo(50);
        assertThat(stats.insights()).isNotEmpty();
        assertThat(stats.records()).anyMatch(r -> r.kind().equals("SPEED"));
    }
}
