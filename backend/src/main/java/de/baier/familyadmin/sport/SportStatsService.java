package de.baier.familyadmin.sport;

import de.baier.familyadmin.sport.SportStatsResponse.*;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
* Pure statistics over a user's activities. No I/O — everything derives from the list passed in.
*
* Fitness model (well-established, also used by TrainingPeaks / intervals.icu):
* - Training load per activity = Banister TRIMP from average heart rate (heart-rate reserve), falling back
*   to Strava's Relative Effort, then to a duration × sport-intensity estimate when no HR exists.
* - Fitness (CTL) = 42-day exponentially weighted average of daily load, Fatigue (ATL) = 7-day average,
*   Form (TSB) = yesterday's fitness − yesterday's fatigue.
* - VO2max estimate per run: ACSM running equation for oxygen cost at the run's speed/grade, scaled by the
*   share of heart-rate reserve used (Swain: %HRR ≈ %VO2R). Rough, but the trend is meaningful.
*/
@Service
public class SportStatsService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Zurich");

    private static final int DEFAULT_RESTING_HR = 60;
    private static final int FULL_SERIES_DAYS = 730;

    private record Act(SportActivity a, SportCategory cat, LocalDateTime local, LocalDate date,
                       double km, double hours, double elev, double load) {}

    public SportStatsResponse compute(List<SportActivity> activities, SportProfile profile, LocalDate today) {
        // ---- physiology -------------------------------------------------------------------------------------
        Integer age = profile != null && profile.getBirthYear() != null ? today.getYear() - profile.getBirthYear() : null;
        String sex = profile != null ? profile.getSex() : null;
        boolean female = "FEMALE".equals(sex);

        Integer profileMax = profile != null ? profile.getMaxHeartRate() : null;
        Integer profileRest = profile != null ? profile.getRestingHeartRate() : null;
        int maxHr = profileMax != null ? profileMax : estimateMaxHr(activities, age);
        int restHr = profileRest != null ? profileRest : DEFAULT_RESTING_HR;
        if (restHr >= maxHr - 20) restHr = Math.max(30, maxHr - 100);

        List<Act> acts = new ArrayList<>(activities.size());
        for (SportActivity a : activities) {
            LocalDateTime local = LocalDateTime.ofInstant(a.getStartTime(), ZONE);
            double km = a.getDistanceM() != null ? a.getDistanceM() / 1000.0 : 0;
            double hours = a.durationSeconds() / 3600.0;
            double elev = a.getElevationGainM() != null ? a.getElevationGainM() : 0;
            acts.add(new Act(a, a.category(), local, local.toLocalDate(), km, hours, elev,
                    trainingLoad(a, maxHr, restHr, female)));
        }
        acts.sort(Comparator.comparing(Act::local));

        if (acts.isEmpty()) {
            return new SportStatsResponse(
                    new Summary(0, 0, 0, 0, 0, null, null, 0),
                    new YearToDate(today.getYear(), today, 0, 0, 0, 0, 0, 0),
                    List.of(), List.of(), List.of(),
                    new Fitness(maxHr, profileMax == null, restHr, profileRest == null, age, sex, 0,
                            0, 0, 0, 0, "NONE", 0, null, List.of(), null, List.of(), List.of(), List.of(),
                            new Intensity(0, 0, 0)),
                    List.of(), new Consistency(0, 0, null, new int[7], new int[24], 0), List.of(), List.of());
        }

        Summary summary = summary(acts);
        YearToDate ytd = yearToDate(acts, today);
        List<YearStat> years = years(acts);
        List<MonthStat> months = months(acts);
        List<DayStat> days = days(acts);
        Fitness fitness = fitness(acts, today, maxHr, profileMax == null, restHr, profileRest == null, age, sex);
        List<PersonalRecord> records = records(acts);
        Consistency consistency = consistency(acts, today);
        List<Insight> insights = insights(acts, today, ytd, fitness, consistency, months);
        List<ActivityItem> recent = acts.reversed().stream().limit(8).map(x -> new ActivityItem(
                x.a().getId() != null ? x.a().getId().toString() : x.a().getExternalId(),
                x.a().getName(), x.a().getSportType(), x.cat().name(), x.local(),
                round1(x.km()), round2(x.hours()), Math.round(x.elev()), x.a().getAvgHeartRate(),
                Math.round(x.load()))).toList();

        return new SportStatsResponse(summary, ytd, years, months, days, fitness, records, consistency, insights, recent);
    }

    // ---- training load ------------------------------------------------------------------------------------

    static int estimateMaxHr(List<SportActivity> activities, Integer age) {
        List<Double> peaks = activities.stream()
                .map(SportActivity::getMaxHeartRate)
                .filter(Objects::nonNull)
                .filter(hr -> hr >= 120 && hr <= 225)
                .sorted(Comparator.reverseOrder())
                .toList();
        if (peaks.size() >= 3) return (int) Math.round(peaks.get(2)); // 3rd highest: ignores sensor spikes
        if (!peaks.isEmpty()) return (int) Math.round(peaks.get(0));
        return age != null ? (int) Math.round(208 - 0.7 * age) : 190;   // Tanaka
    }

    static double trainingLoad(SportActivity a, int maxHr, int restHr, boolean female) {
        double minutes = a.durationSeconds() / 60.0;
        if (minutes <= 0) return 0;
        Double avg = a.getAvgHeartRate();
        if (avg != null && avg > restHr) {
            double hrr = Math.min(1.0, (avg - restHr) / (double) (maxHr - restHr));
            double k = female ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr);
            return minutes * hrr * k;
        }
        if (a.getRelativeEffort() != null) return a.getRelativeEffort();
        double factor = switch (a.category()) {
            case RUN -> 1.0;
            case SWIM -> 0.9;
            case RIDE -> 0.75;
            case WINTER -> 0.45;   // downhill days include lift time
            case STRENGTH -> 0.6;
            case WALK -> 0.35;
            case OTHER -> 0.6;
        };
        return minutes * factor;
    }

    // ---- totals -------------------------------------------------------------------------------------------

    private Summary summary(List<Act> acts) {
        double km = 0, h = 0, elev = 0, cal = 0;
        Set<LocalDate> activeDays = new HashSet<>();
        for (Act x : acts) {
            km += x.km();
            h += x.hours();
            elev += x.elev();
            if (x.a().getCalories() != null) cal += x.a().getCalories();
            activeDays.add(x.date());
        }
        return new Summary(acts.size(), round1(km), round1(h), Math.round(elev), Math.round(cal),
                acts.getFirst().date(), acts.getLast().date(), activeDays.size());
    }

    private YearToDate yearToDate(List<Act> acts, LocalDate today) {
        LocalDate prevSameDay = today.minusYears(1);
        int c = 0, pc = 0;
        double km = 0, h = 0, pkm = 0, ph = 0;
        for (Act x : acts) {
            if (x.date().getYear() == today.getYear() && !x.date().isAfter(today)) {
                c++; km += x.km(); h += x.hours();
            } else if (x.date().getYear() == prevSameDay.getYear() && !x.date().isAfter(prevSameDay)) {
                pc++; pkm += x.km(); ph += x.hours();
            }
        }
        return new YearToDate(today.getYear(), today, c, round1(km), round1(h), pc, round1(pkm), round1(ph));
    }

    private List<CategoryTotals> byCategory(List<Act> acts) {
        Map<SportCategory, List<Act>> grouped = acts.stream()
                .collect(Collectors.groupingBy(Act::cat, () -> new EnumMap<>(SportCategory.class), Collectors.toList()));
        return grouped.entrySet().stream().map(e -> new CategoryTotals(e.getKey().name(), e.getValue().size(),
                round1(e.getValue().stream().mapToDouble(Act::km).sum()),
                round1(e.getValue().stream().mapToDouble(Act::hours).sum()),
                Math.round(e.getValue().stream().mapToDouble(Act::elev).sum()))).toList();
    }

    private List<YearStat> years(List<Act> acts) {
        Map<Integer, List<Act>> byYear = acts.stream()
                .collect(Collectors.groupingBy(x -> x.date().getYear(), TreeMap::new, Collectors.toList()));
        return byYear.entrySet().stream().map(e -> new YearStat(e.getKey(), e.getValue().size(),
                round1(e.getValue().stream().mapToDouble(Act::km).sum()),
                round1(e.getValue().stream().mapToDouble(Act::hours).sum()),
                Math.round(e.getValue().stream().mapToDouble(Act::elev).sum()),
                (int) e.getValue().stream().map(Act::date).distinct().count(),
                byCategory(e.getValue()))).toList();
    }

    private List<MonthStat> months(List<Act> acts) {
        Map<YearMonth, List<Act>> byMonth = acts.stream()
                .collect(Collectors.groupingBy(x -> YearMonth.from(x.date()), TreeMap::new, Collectors.toList()));
        return byMonth.entrySet().stream().map(e -> new MonthStat(e.getKey().toString(), e.getValue().size(),
                round1(e.getValue().stream().mapToDouble(Act::km).sum()),
                round1(e.getValue().stream().mapToDouble(Act::hours).sum()),
                Math.round(e.getValue().stream().mapToDouble(Act::elev).sum()),
                byCategory(e.getValue()))).toList();
    }

    private List<DayStat> days(List<Act> acts) {
        Map<LocalDate, List<Act>> byDay = acts.stream()
                .collect(Collectors.groupingBy(Act::date, TreeMap::new, Collectors.toList()));
        return byDay.entrySet().stream().map(e -> new DayStat(e.getKey(), e.getValue().size(),
                round1(e.getValue().stream().mapToDouble(Act::km).sum()),
                round2(e.getValue().stream().mapToDouble(Act::hours).sum()),
                Math.round(e.getValue().stream().mapToDouble(Act::load).sum()))).toList();
    }

    // ---- fitness ------------------------------------------------------------------------------------------

    private Fitness fitness(List<Act> acts, LocalDate today, int maxHr, boolean maxEst, int restHr, boolean restEst,
                            Integer age, String sex) {
        Map<LocalDate, Double> loadByDay = new HashMap<>();
        for (Act x : acts) loadByDay.merge(x.date(), x.load(), Double::sum);

        LocalDate start = acts.getFirst().date();
        LocalDate end = today.isBefore(acts.getLast().date()) ? acts.getLast().date() : today;
        double ctl = 0, atl = 0, peak = 0;
        LocalDate peakDate = null;
        double form = 0;
        List<FitnessPoint> series = new ArrayList<>();
        Map<LocalDate, Double> ctlByDay = new HashMap<>();
        LocalDate fullFrom = end.minusDays(FULL_SERIES_DAYS);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            form = ctl - atl;
            double load = loadByDay.getOrDefault(d, 0.0);
            ctl += (load - ctl) / 42.0;
            atl += (load - atl) / 7.0;
            ctlByDay.put(d, ctl);
            if (ctl > peak) { peak = ctl; peakDate = d; }
            boolean include = !d.isBefore(fullFrom) || d.getDayOfWeek() == DayOfWeek.MONDAY;
            if (include) series.add(new FitnessPoint(d, round1(ctl), round1(atl), round1(form)));
        }
        double ramp = ctl - ctlByDay.getOrDefault(end.minusDays(7), 0.0);

        String status;
        if (ctl < 5) status = "DETRAINED";
        else if (form > 15) status = "FRESH";        // fresh, but fitness starts to fade if it lasts
        else if (form > 5) status = "READY";
        else if (form >= -10) status = "NEUTRAL";
        else if (form >= -30) status = "PRODUCTIVE";
        else status = "OVERREACHING";

        long withHr = acts.stream().filter(x -> x.a().getAvgHeartRate() != null).count();

        // VO2max per qualifying run, aggregated monthly (75th percentile = "what you were capable of")
        Map<YearMonth, List<Double>> vo2ByMonth = new TreeMap<>();
        List<double[]> vo2Dated = new ArrayList<>();
        for (Act x : acts) {
            Double v = vo2maxEstimate(x, maxHr, restHr);
            if (v == null) continue;
            vo2ByMonth.computeIfAbsent(YearMonth.from(x.date()), k -> new ArrayList<>()).add(v);
            vo2Dated.add(new double[]{x.date().toEpochDay(), v});
        }
        List<MonthValue> vo2Trend = vo2ByMonth.entrySet().stream()
                .map(e -> new MonthValue(e.getKey().toString(), round1(percentile(e.getValue(), 0.75)), e.getValue().size()))
                .toList();
        Double vo2Now = recentPercentile(vo2Dated, today, 90, 3);
        if (vo2Now == null) vo2Now = recentPercentile(vo2Dated, today, 180, 3);

        // Aerobic efficiency: metres per heartbeat (runs), watts per beat (rides with power)
        List<MonthValue> runEff = monthlyMedian(acts,
                x -> x.cat() == SportCategory.RUN && x.a().getAvgHeartRate() != null && x.a().getAvgSpeedMps() != null
                        && x.hours() >= 0.25 && x.a().getAvgHeartRate() > restHr + 20,
                x -> x.a().getAvgSpeedMps() * 60.0 / x.a().getAvgHeartRate(), 2);
        List<MonthValue> rideEff = monthlyMedian(acts,
                x -> x.cat() == SportCategory.RIDE && x.a().getAvgHeartRate() != null && x.a().getAvgWatts() != null
                        && x.hours() >= 0.33 && x.a().getAvgHeartRate() > restHr + 20,
                x -> x.a().getAvgWatts() / x.a().getAvgHeartRate(), 2);

        // Intensity distribution of the last 90 days, by each activity's average HR (% of max HR)
        double easy = 0, moderate = 0, hard = 0;
        LocalDate from90 = today.minusDays(90);
        for (Act x : acts) {
            if (x.date().isBefore(from90) || x.a().getAvgHeartRate() == null) continue;
            double pct = x.a().getAvgHeartRate() / maxHr;
            if (pct < 0.77) easy += x.hours();
            else if (pct < 0.87) moderate += x.hours();
            else hard += x.hours();
        }

        return new Fitness(maxHr, maxEst, restHr, restEst, age, sex,
                round2(acts.isEmpty() ? 0 : withHr / (double) acts.size()),
                round1(ctl), round1(atl), round1(ctl - atl), round1(ramp), status,
                round1(peak), peakDate, series, vo2Now != null ? round1(vo2Now) : null, vo2Trend,
                runEff, rideEff, new Intensity(round1(easy), round1(moderate), round1(hard)));
    }

    static Double vo2maxEstimate(Act x, int maxHr, int restHr) {
        SportActivity a = x.a();
        if (x.cat() != SportCategory.RUN || a.getAvgHeartRate() == null || a.getDistanceM() == null) return null;
        if (a.durationSeconds() < 15 * 60 || a.getDistanceM() < 2000) return null;
        double speed = a.getDistanceM() / a.durationSeconds();          // m/s
        if (speed < 1.8 || speed > 7.0) return null;                       // walking breaks / GPS junk
        double hrr = (a.getAvgHeartRate() - restHr) / (double) (maxHr - restHr);
        if (hrr < 0.5 || hrr > 1.0) return null;                           // too easy to extrapolate reliably
        double grade = a.getElevationGainM() != null ? Math.min(0.08, 0.5 * a.getElevationGainM() / a.getDistanceM()) : 0;
        double vMin = speed * 60.0;
        double vo2 = 0.2 * vMin + 0.9 * vMin * grade + 3.5;
        double est = (vo2 - 3.5) / hrr + 3.5;
        return est >= 20 && est <= 90 ? est : null;
    }

    private static Double recentPercentile(List<double[]> dated, LocalDate today, int days, int minSamples) {
        long from = today.minusDays(days).toEpochDay();
        List<Double> vals = dated.stream().filter(d -> d[0] >= from).map(d -> d[1]).toList();
        return vals.size() >= minSamples ? percentile(vals, 0.75) : null;
    }

    private static List<MonthValue> monthlyMedian(List<Act> acts, Predicate<Act> filter,
                                                  java.util.function.ToDoubleFunction<Act> metric, int digits) {
        Map<YearMonth, List<Double>> byMonth = new TreeMap<>();
        for (Act x : acts) {
            if (filter.test(x)) byMonth.computeIfAbsent(YearMonth.from(x.date()), k -> new ArrayList<>()).add(metric.applyAsDouble(x));
        }
        double f = Math.pow(10, digits);
        return byMonth.entrySet().stream()
                .map(e -> new MonthValue(e.getKey().toString(), Math.round(percentile(e.getValue(), 0.5) * f) / f, e.getValue().size()))
                .toList();
    }

    static double percentile(List<Double> values, double p) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        double idx = p * (sorted.size() - 1);
        int lo = (int) Math.floor(idx), hi = (int) Math.ceil(idx);
        return sorted.get(lo) + (sorted.get(hi) - sorted.get(lo)) * (idx - lo);
    }

    // ---- records ------------------------------------------------------------------------------------------

    private List<PersonalRecord> records(List<Act> acts) {
        List<PersonalRecord> out = new ArrayList<>();
        for (SportCategory cat : List.of(SportCategory.RUN, SportCategory.RIDE, SportCategory.SWIM, SportCategory.WALK,
                SportCategory.WINTER)) {
            List<Act> list = acts.stream().filter(x -> x.cat() == cat).toList();
            if (list.isEmpty()) continue;
            list.stream().filter(x -> x.km() > 0).max(Comparator.comparingDouble(Act::km))
                    .ifPresent(x -> out.add(record(cat, "DISTANCE", "Längste Distanz", x.km() * 1000, x)));
            list.stream().max(Comparator.comparingDouble(Act::hours))
                    .ifPresent(x -> out.add(record(cat, "DURATION", "Längste Dauer", x.a().durationSeconds(), x)));
            list.stream().filter(x -> x.elev() > 0).max(Comparator.comparingDouble(Act::elev))
                    .ifPresent(x -> out.add(record(cat, "ELEVATION", "Meiste Höhenmeter", x.elev(), x)));
            double minKm = switch (cat) {
                case RUN -> 5; case RIDE -> 20; case SWIM -> 1; default -> -1;
            };
            if (minKm > 0) {
                list.stream().filter(x -> x.km() >= minKm && x.a().getAvgSpeedMps() != null)
                        .max(Comparator.comparingDouble(x -> x.a().getAvgSpeedMps()))
                        .ifPresent(x -> out.add(record(cat, "SPEED",
                                "Schnellster Schnitt (ab " + (int) minKm + " km)", x.a().getAvgSpeedMps(), x)));
            }
        }
        return out;
    }

    private static PersonalRecord record(SportCategory cat, String kind, String label, double value, Act x) {
        return new PersonalRecord(cat.name(), kind, label, Math.round(value * 100) / 100.0, x.a().getName(), x.date());
    }

    // ---- consistency --------------------------------------------------------------------------------------

    private Consistency consistency(List<Act> acts, LocalDate today) {
        int[] weekday = new int[7];
        int[] hour = new int[24];
        Set<LocalDate> weeks = new TreeSet<>();
        for (Act x : acts) {
            weekday[x.date().getDayOfWeek().getValue() - 1]++;
            hour[x.local().getHour()]++;
            weeks.add(weekStart(x.date()));
        }

        int longest = 0, run = 0;
        LocalDate prev = null, longestEnd = null;
        for (LocalDate w : weeks) {
            run = prev != null && w.equals(prev.plusWeeks(1)) ? run + 1 : 1;
            if (run > longest) { longest = run; longestEnd = w.plusDays(6); }
            prev = w;
        }

        // Current streak: counting back from this week (or last week, if this week has no activity yet)
        LocalDate w = weekStart(today);
        if (!weeks.contains(w)) w = w.minusWeeks(1);
        int current = 0;
        while (weeks.contains(w)) { current++; w = w.minusWeeks(1); }

        LocalDate from12 = today.minusWeeks(12);
        long last12 = acts.stream().filter(x -> x.date().isAfter(from12) && !x.date().isAfter(today)).count();
        return new Consistency(current, longest, longestEnd, weekday, hour, round1(last12 / 12.0));
    }

    private static LocalDate weekStart(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    // ---- insights (German, shown as cards) -----------------------------------------------------------------

    private List<Insight> insights(List<Act> acts, LocalDate today, YearToDate ytd, Fitness f, Consistency c,
                                   List<MonthStat> months) {
        List<Insight> out = new ArrayList<>();

        // Form → what to do today
        switch (f.formStatus()) {
            case "FRESH" -> out.add(new Insight("POSITIVE", "Topfrisch",
                    "Deine Form liegt bei +" + fmt0(f.currentForm()) + ". Ideal für einen Wettkampf oder eine harte Einheit — "
                            + "aber Vorsicht: Bleibt es länger so ruhig, sinkt deine Fitness."));
            case "READY" -> out.add(new Insight("POSITIVE", "Bereit für mehr",
                    "Form +" + fmt0(f.currentForm()) + ": Du bist erholt. Ein guter Tag für eine Qualitätseinheit."));
            case "NEUTRAL" -> out.add(new Insight("NEUTRAL", "Im Gleichgewicht",
                    "Form " + signed(f.currentForm()) + ": Belastung und Erholung halten sich die Waage — Fitness wird gehalten."));
            case "PRODUCTIVE" -> out.add(new Insight("POSITIVE", "Produktives Training",
                    "Form " + signed(f.currentForm()) + ": Du baust gerade Fitness auf. Plane in den nächsten Tagen bewusst Erholung ein."));
            case "OVERREACHING" -> out.add(new Insight("WARNING", "Hohe Ermüdung",
                    "Form " + signed(f.currentForm()) + ": Deutlich mehr Belastung als gewohnt. Ein bis zwei lockere Tage senken das Verletzungsrisiko."));
            case "DETRAINED" -> out.add(new Insight("NEUTRAL", "Pause",
                    "In den letzten Wochen war wenig los — deine Fitness ist auf Basisniveau. Jede Einheit zählt jetzt doppelt."));
            default -> { }
        }

        if (f.rampRate() > 7) {
            out.add(new Insight("WARNING", "Steiler Anstieg",
                    "Deine Fitness ist in 7 Tagen um " + fmt0(f.rampRate()) + " Punkte gestiegen. Mehr als ~7 pro Woche gilt als riskant."));
        }

        // Fitness vs all-time peak
        if (f.peakFitness() > 10 && f.peakFitnessDate() != null) {
            double pct = f.currentFitness() / f.peakFitness() * 100;
            if (pct >= 97) {
                out.add(new Insight("POSITIVE", "Allzeit-Hoch",
                        "Deine Fitness ist so hoch wie nie zuvor (" + fmt0(f.currentFitness()) + " Punkte)."));
            } else {
                out.add(new Insight("NEUTRAL", "Fitness im Vergleich",
                        "Aktuell " + fmt0(pct) + " % deines Höchstwerts vom " + germanMonthYear(f.peakFitnessDate()) + "."));
            }
        }

        // Year to date vs previous year
        if (ytd.prevHours() > 1) {
            double diff = (ytd.hours() - ytd.prevHours()) / ytd.prevHours() * 100;
            String km = ytd.distanceKm() > 0 ? fmt0(ytd.distanceKm()) + " km / " : "";
            String head = "Bis heute " + km + fmt0(ytd.hours()) + " h in " + ytd.year() + " — ";
            if (Math.abs(diff) < 3) {
                out.add(new Insight("NEUTRAL", "Auf Vorjahreskurs",
                        head + "fast genau so viel Trainingszeit wie zum gleichen Zeitpunkt " + (ytd.year() - 1) + "."));
            } else {
                out.add(new Insight(diff >= 0 ? "POSITIVE" : "NEUTRAL",
                        diff >= 0 ? "Vor dem Vorjahr" : "Hinter dem Vorjahr",
                        head + fmt0(Math.abs(diff)) + " % " + (diff >= 0 ? "mehr" : "weniger")
                                + " Trainingszeit als zum gleichen Zeitpunkt " + (ytd.year() - 1) + "."));
            }
        }

        // VO2max trend
        if (f.vo2max() != null) {
            String month12 = YearMonth.from(today.minusMonths(12)).toString();
            Optional<MonthValue> then = f.vo2maxTrend().stream()
                    .filter(m -> m.month().compareTo(month12) <= 0).reduce((a, b) -> b);
            String text = "Geschätzte VO₂max aus deinen Läufen: " + fmt1(f.vo2max()) + " ml/kg/min";
            if (then.isPresent()) {
                double d = f.vo2max() - then.get().value();
                text += " (" + signed1(d) + " ggü. vor einem Jahr)";
            }
            out.add(new Insight("NEUTRAL", "Ausdauerleistung", text + "."));
        }

        // Running efficiency trend (last 3 months vs same 3 months a year earlier)
        Double effNow = avgOfMonths(f.runEfficiency(), YearMonth.from(today).minusMonths(2), YearMonth.from(today));
        Double effThen = avgOfMonths(f.runEfficiency(), YearMonth.from(today).minusMonths(14), YearMonth.from(today).minusMonths(12));
        if (effNow != null && effThen != null && effThen > 0) {
            double d = (effNow - effThen) / effThen * 100;
            out.add(new Insight(d >= 0 ? "POSITIVE" : "NEUTRAL", "Lauf-Effizienz",
                    "Du schaffst " + fmt2(effNow) + " m pro Herzschlag — " + fmt0(Math.abs(d)) + " % "
                            + (d >= 0 ? "mehr" : "weniger") + " als vor einem Jahr. "
                            + (d >= 0 ? "Bei gleichem Puls bist du schneller geworden." : "Hitze, Gelände oder Müdigkeit können das drücken.")));
        }

        // Intensity distribution (80/20)
        Intensity in = f.intensity90d();
        double total = in.easyHours() + in.moderateHours() + in.hardHours();
        if (total >= 5) {
            double easyPct = in.easyHours() / total * 100;
            if (easyPct < 65) {
                out.add(new Insight("WARNING", "Zu oft im mittleren Bereich",
                        "Nur " + fmt0(easyPct) + " % deiner Zeit der letzten 90 Tage war locker. Ausdauersportler profitieren meist von ~80 % "
                                + "lockerem Training und wenigen, wirklich harten Einheiten."));
            } else {
                out.add(new Insight("POSITIVE", "Gute Intensitätsverteilung",
                        fmt0(easyPct) + " % deiner Trainingszeit war locker — nah am bewährten 80/20-Prinzip."));
            }
        }

        // Streaks
        if (c.currentWeekStreak() >= 3) {
            boolean best = c.currentWeekStreak() >= c.longestWeekStreak();
            out.add(new Insight("POSITIVE", best ? "Rekord-Serie" : "Dranbleiben",
                    c.currentWeekStreak() + " Wochen in Folge aktiv" + (best ? " — deine längste Serie bisher!"
                            : ". Dein Rekord: " + c.longestWeekStreak() + " Wochen.")));
        }

        // Habits
        int favDay = argMax(c.weekdayCounts());
        int favHour = argMax(c.hourCounts());
        String dayName = DayOfWeek.of(favDay + 1).getDisplayName(TextStyle.FULL, Locale.GERMAN);
        out.add(new Insight("NEUTRAL", "Deine Gewohnheit",
                "Am häufigsten trainierst du am " + dayName + ", meist " + dayPart(favHour) + "."));

        // Best month ever
        months.stream().max(Comparator.comparingDouble(MonthStat::hours)).ifPresent(m -> {
            YearMonth ym = YearMonth.parse(m.month());
            out.add(new Insight("NEUTRAL", "Stärkster Monat",
                    germanMonthYear(ym.atDay(1)) + " mit " + fmt0(m.hours()) + " h und " + m.count() + " Aktivitäten."));
        });

        return out;
    }

    private static Double avgOfMonths(List<MonthValue> values, YearMonth from, YearMonth to) {
        List<MonthValue> in = values.stream()
                .filter(v -> { YearMonth m = YearMonth.parse(v.month()); return !m.isBefore(from) && !m.isAfter(to); })
                .toList();
        if (in.isEmpty()) return null;
        double w = in.stream().mapToInt(MonthValue::samples).sum();
        return in.stream().mapToDouble(v -> v.value() * v.samples()).sum() / w;
    }

    private static String dayPart(int hour) {
        if (hour < 5) return "nachts";
        if (hour < 11) return "morgens";
        if (hour < 14) return "mittags";
        if (hour < 18) return "nachmittags";
        return "abends";
    }

    private static String germanMonthYear(LocalDate d) {
        return d.getMonth().getDisplayName(TextStyle.FULL, Locale.GERMAN) + " " + d.getYear();
    }

    private static int argMax(int[] values) {
        int best = 0;
        for (int i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
        return best;
    }

    private static double round1(double v) { return Math.round(v * 10) / 10.0; }
    private static double round2(double v) { return Math.round(v * 100) / 100.0; }
    private static String fmt0(double v) { return String.format(Locale.GERMAN, "%,.0f", v); }
    private static String fmt1(double v) { return String.format(Locale.GERMAN, "%.1f", v); }
    private static String fmt2(double v) { return String.format(Locale.GERMAN, "%.2f", v); }
    private static String signed(double v) { return (v >= 0 ? "+" : "−") + fmt0(Math.abs(v)); }
    private static String signed1(double v) { return (v >= 0 ? "+" : "−") + fmt1(Math.abs(v)); }
}
