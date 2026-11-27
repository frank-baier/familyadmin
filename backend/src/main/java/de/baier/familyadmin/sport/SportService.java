package de.baier.familyadmin.sport;

import de.baier.familyadmin.user.User;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Sport module: every activity and profile is strictly scoped to the current user. */
@Service
@RequiredArgsConstructor
public class SportService {

    private static final String SOURCE_STRAVA = "STRAVA";

    private final SportActivityRepository activityRepository;
    private final SportProfileRepository profileRepository;
    private final StravaExportParser parser;
    private final SportStatsService statsService;

    /** Idempotent: re-importing a newer export updates existing activities instead of duplicating them. */
    @Transactional
    public SportImportResult importStravaExport(MultipartFile file, User user) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Keine Datei übermittelt.");
        }
        StravaExportParser.ParseResult parsed;
        try (InputStream in = file.getInputStream()) {
            parsed = parser.parse(in, file.getOriginalFilename());
        }
        if (parsed.activities().isEmpty()) {
            throw new IllegalArgumentException("Keine Aktivitäten in der Datei gefunden.");
        }

        Map<String, SportActivity> existing = activityRepository.findByUserIdAndSource(user.getId(), SOURCE_STRAVA)
                .stream().collect(Collectors.toMap(SportActivity::getExternalId, Function.identity(), (a, b) -> a));

        int imported = 0;
        int updated = 0;
        Map<String, SportActivity> toSave = new LinkedHashMap<>();
        for (StravaExportParser.ParsedActivity p : parsed.activities()) {
            SportActivity a = existing.get(p.externalId());
            if (a == null) {
                a = SportActivity.builder().userId(user.getId()).source(SOURCE_STRAVA).externalId(p.externalId()).build();
                if (!toSave.containsKey(p.externalId())) imported++;
            } else {
                updated++;
            }
            apply(a, p);
            toSave.put(p.externalId(), a);
        }
        activityRepository.saveAll(toSave.values());
        return new SportImportResult(imported, updated, (int) activityRepository.countByUserId(user.getId()),
                parsed.warnings());
    }

    private static void apply(SportActivity a, StravaExportParser.ParsedActivity p) {
        a.setName(truncate(p.name(), 500));
        a.setSportType(truncate(p.sportType(), 100));
        a.setStartTime(p.startTime());
        a.setElapsedSeconds(p.elapsedSeconds());
        a.setMovingSeconds(p.movingSeconds());
        a.setDistanceM(p.distanceM());
        a.setElevationGainM(p.elevationGainM());
        a.setAvgHeartRate(p.avgHeartRate());
        a.setMaxHeartRate(p.maxHeartRate());
        a.setAvgSpeedMps(p.avgSpeedMps());
        a.setMaxSpeedMps(p.maxSpeedMps());
        a.setAvgWatts(p.avgWatts());
        a.setCalories(p.calories());
        a.setRelativeEffort(p.relativeEffort());
        a.setCommute(p.commute());
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    @Transactional(readOnly = true)
    public SportStatsResponse getStats(User user) {
        List<SportActivity> activities = activityRepository.findByUserIdOrderByStartTimeAsc(user.getId());
        SportProfile profile = profileRepository.findById(user.getId()).orElse(null);
        return statsService.compute(activities, profile, LocalDate.now(SportStatsService.ZONE));
    }

    @Transactional(readOnly = true)
    public SportProfileDto getProfile(User user) {
        return profileRepository.findById(user.getId())
                .map(p -> new SportProfileDto(p.getMaxHeartRate(), p.getRestingHeartRate(), p.getBirthYear(), p.getSex()))
                .orElse(new SportProfileDto(null, null, null, null));
    }

    @Transactional
    public SportProfileDto updateProfile(SportProfileDto dto, User user) {
        SportProfile p = profileRepository.findById(user.getId())
                .orElseGet(() -> SportProfile.builder().userId(user.getId()).build());
        p.setMaxHeartRate(dto.maxHeartRate());
        p.setRestingHeartRate(dto.restingHeartRate());
        p.setBirthYear(dto.birthYear());
        p.setSex(dto.sex());
        profileRepository.save(p);
        return dto;
    }

    @Transactional
    public int deleteAllActivities(User user) {
        return activityRepository.deleteAllByUserId(user.getId());
    }
}
