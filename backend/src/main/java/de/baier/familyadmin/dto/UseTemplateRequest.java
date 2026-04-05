package de.baier.familyadmin.dto;

import java.util.List;
import java.util.UUID;

public record UseTemplateRequest(
        List<UUID> selectedSubtaskIds
) {}
