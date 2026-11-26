package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.ChatHistory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record ChatHistoryResponse(
        UUID id,
        String question,
        String answer,
        List<String> sources,
        String status,
        Instant createdAt,
        String model,
        BigDecimal costUsd,
        Long durationMs
) {
    public static ChatHistoryResponse from(ChatHistory h) {
        List<String> src = h.getSources().isBlank()
                ? List.of()
                : Arrays.asList(h.getSources().split(","));
        return new ChatHistoryResponse(h.getId(), h.getQuestion(), h.getAnswer(), src, h.getStatus(), h.getCreatedAt(),
                h.getModel(), h.getCostUsd(), h.getDurationMs());
    }
}
