package de.baier.familyadmin.dto;

import java.util.List;

public record SportImportResult(int imported, int updated, int totalActivities, List<String> warnings) {}
