package de.baier.familyadmin.dto;

import java.util.List;

public record HealthIngestResult(int saved, List<String> warnings) {}
