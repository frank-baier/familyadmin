package de.baier.familyadmin.service;

import de.baier.familyadmin.model.AnalysisType;
import de.baier.familyadmin.model.Portfolio;
import de.baier.familyadmin.model.PortfolioPosition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Generates per-stock news summaries via the Anthropic Messages API — not a portfolio-wide
 * asset-allocation or rebalancing commentary, which was explicitly not wanted. News per ticker
 * comes from YahooNewsService; Claude's job here is purely to summarize/filter it in German.
 * Requires ANTHROPIC_API_KEY — if unset, callers get a clear error rather than a silent no-op.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeAnalysisService {

    private final YahooNewsService yahooNewsService;

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

        String prompt = buildPrompt(portfolio);

        Map<String, Object> body = Map.of(
                "model", model,
                "max_tokens", 2000,
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

    private String buildPrompt(Portfolio portfolio) {
        StringBuilder newsSection = new StringBuilder();
        for (PortfolioPosition p : portfolio.getPositions()) {
            var news = yahooNewsService.fetchNews(p.getTicker(), 3);
            if (news.isEmpty()) continue;

            newsSection.append("### %s (%s)%n".formatted(
                    p.getTicker(), StringUtils.hasText(p.getName()) ? p.getName() : "unbekannt"));
            for (var item : news) {
                newsSection.append("- %s: %s%n".formatted(item.title(), item.description()));
            }
            newsSection.append("\n");
        }

        if (newsSection.isEmpty()) {
            newsSection.append("Keine aktuellen News zu den gehaltenen Positionen gefunden.");
        }

        return """
                Du bist ein Finanzanalyst. Fasse für eine Familie die wichtigsten aktuellen Nachrichten
                zu jeder ihrer gehaltenen Aktien-/ETF-Positionen zusammen — pro Position ein kurzer Absatz.
                Antworte auf Deutsch, prägnant, strukturiert nach Ticker.
                Gib KEINE Gesamtportfolio-Analyse, keine Asset-Allocation- oder Rebalancing-Kommentare —
                nur was für die einzelnen Positionen an Nachrichten relevant ist. Wenn zu einer Position
                keine relevanten/wichtigen News vorliegen, lass sie einfach weg statt Füllsätze zu schreiben.

                Depot: %s

                Aktuelle Nachrichten pro Position:
                %s
                """.formatted(portfolio.getName(), newsSection);
    }
}
