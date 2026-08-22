package de.baier.familyadmin.service;

import de.baier.familyadmin.model.AnalysisType;
import de.baier.familyadmin.model.Portfolio;
import de.baier.familyadmin.model.PortfolioPosition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Generates natural-language portfolio analyses via the Anthropic Messages API.
 * Requires ANTHROPIC_API_KEY — if unset, callers get a clear error rather than a silent no-op,
 * since a "weekly analysis" that never runs would fail invisibly otherwise.
 */
@Slf4j
@Service
public class ClaudeAnalysisService {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-sonnet-5}")
    private String model;

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.anthropic.com/v1")
            .build();

    public String analyze(Portfolio portfolio, AnalysisType type) {
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("ANTHROPIC_API_KEY ist nicht konfiguriert");
        }

        String prompt = buildPrompt(portfolio, type);

        Map<String, Object> body = Map.of(
                "model", model,
                "max_tokens", 1500,
                "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        Map<?, ?> response = restClient.post()
                .uri("/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);

        String text = extractText(response);
        if (!StringUtils.hasText(text)) {
            throw new IllegalStateException(
                    "Claude-Antwort enthielt keinen Analysetext (unerwartetes Antwortformat).");
        }
        return text;
    }

    /**
     * The content array can contain non-text blocks (e.g. a thinking block) before the actual
     * text block, so index 0 isn't reliable — scan for the first block with type "text" instead.
     */
    @SuppressWarnings("unchecked")
    private String extractText(Map<?, ?> response) {
        if (response == null) return "";
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
        if (content == null) return "";
        for (Map<String, Object> block : content) {
            if ("text".equals(block.get("type")) && block.get("text") != null) {
                return block.get("text").toString();
            }
        }
        return "";
    }

    private String buildPrompt(Portfolio portfolio, AnalysisType type) {
        StringBuilder positions = new StringBuilder();
        for (PortfolioPosition p : portfolio.getPositions()) {
            BigDecimal costBasis = p.getPurchasePrice().multiply(p.getShares());
            BigDecimal currentValue = p.getCurrentValue() != null ? p.getCurrentValue() : BigDecimal.ZERO;
            BigDecimal gainLossPercent = costBasis.signum() != 0
                    ? currentValue.subtract(costBasis).divide(costBasis, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                    : BigDecimal.ZERO;
            positions.append("- %s (%s): %s Stück, Einstandswert %s, aktueller Wert %s, Performance %s%%%n".formatted(
                    p.getTicker(),
                    StringUtils.hasText(p.getName()) ? p.getName() : "unbekannt",
                    p.getShares(), costBasis, currentValue, gainLossPercent));
        }

        String instruction = switch (type) {
            case WEEKLY -> "Gib eine kurze wöchentliche Zusammenfassung der Portfolio-Performance: "
                    + "größte Gewinner/Verlierer, auffällige Bewegungen, Gesamttrend.";
            case REBALANCING -> "Analysiere die Portfolio-Gewichtung und gib konkrete Rebalancing-Empfehlungen: "
                    + "welche Positionen sind über-/untergewichtet, was könnte reduziert/aufgestockt werden.";
            case ON_DEMAND -> "Gib eine allgemeine Einschätzung der Portfolio-Performance und Zusammensetzung.";
        };

        return """
                Du bist ein Finanzanalyst und analysierst das folgende Aktienportfolio einer Familie.
                Antworte auf Deutsch, prägnant (max. 300 Wörter), strukturiert mit kurzen Absätzen.
                Gib keine individuelle Anlageberatung, sondern eine sachliche Analyse der vorliegenden Daten.

                Portfolio: %s

                Positionen:
                %s

                Aufgabe: %s
                """.formatted(portfolio.getName(), positions, instruction);
    }
}
