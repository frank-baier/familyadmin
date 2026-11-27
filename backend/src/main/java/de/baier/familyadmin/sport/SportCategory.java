package de.baier.familyadmin.sport;

import java.util.Locale;

/** Coarse grouping of the many Strava sport types, used for statistics. */
public enum SportCategory {
    RUN, RIDE, SWIM, WALK, WINTER, STRENGTH, OTHER;

    public static SportCategory of(String sportType) {
        if (sportType == null) return OTHER;
        String t = sportType.toLowerCase(Locale.ROOT).replaceAll("[^a-zäöü]", "");
        if (t.contains("langlauf") || t.contains("nordicski")) return WINTER;
        if (t.contains("run") || t.contains("lauf")) return RUN;
        if (t.contains("ride") || t.contains("bike") || t.contains("cycl") || t.contains("velo")
                || t.contains("rad") || t.contains("handcycle")) return RIDE;
        if (t.contains("swim") || t.contains("schwimm")) return SWIM;
        if (t.contains("walk") || t.contains("hike") || t.contains("wander") || t.contains("spazier")
                || t.contains("gehen")) return WALK;
        if (t.contains("ski") || t.contains("snow") || t.contains("skate") || t.contains("langlauf")) return WINTER;
        if (t.contains("weight") || t.contains("workout") || t.contains("crossfit") || t.contains("yoga")
                || t.contains("pilates") || t.contains("hiit") || t.contains("training") || t.contains("kraft")) return STRENGTH;
        return OTHER;
    }
}
