package de.baier.familyadmin.tasks;

import java.util.List;
import java.util.UUID;

public record UseTemplateRequest(
        List<UUID> selectedSubtaskIds
) {}
