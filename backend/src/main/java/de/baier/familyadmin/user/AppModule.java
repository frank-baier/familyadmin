package de.baier.familyadmin.user;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Module apps a user can be granted. Each key matches the frontend app / subdomain and
 * becomes the authority {@code MODULE_<key>}; {@link #API_PATHS} decides which API paths
 * need it (see SecurityConfig). Admins get every module.
 */
public final class AppModule {

    public static final List<String> ALL =
            List.of("tasks", "recipes", "travel", "notes", "documents", "finance", "sport");

    public static final Map<String, List<String>> API_PATHS = Map.of(
            "tasks", List.of("/api/tasks/**", "/api/task-templates/**"),
            "recipes", List.of("/api/recipes/**", "/api/meal-plans/**", "/api/meal-plan/**"),
            "travel", List.of("/api/trips/**", "/api/transport/**"),
            "notes", List.of("/api/notes/**"),
            "documents", List.of("/api/documents/**", "/api/chat/**"),
            "finance", List.of("/api/portfolios/**"),
            "sport", List.of("/api/sport/**", "/api/health/**"));

    public static String authority(String module) {
        return "MODULE_" + module;
    }

    /** Known module keys only, in canonical order. */
    public static List<String> normalise(Collection<String> modules) {
        return ALL.stream().filter(modules::contains).toList();
    }

    private AppModule() {}
}
