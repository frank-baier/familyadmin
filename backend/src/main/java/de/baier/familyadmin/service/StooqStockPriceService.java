package de.baier.familyadmin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Optional;

/**
 * Free, key-less stock price lookup via stooq.com's CSV quote endpoint.
 * No SLA/rate-limit guarantees — acceptable for a weekly, low-volume hobby portfolio.
 * US tickers on Stooq require a ".us" suffix (e.g. "aapl.us"); we try the raw
 * ticker first and fall back to that suffix since most retail portfolios are US stocks.
 */
@Slf4j
@Service
public class StooqStockPriceService implements StockPriceService {

    @Value("${stooq.base-url:https://stooq.com/q/l/}")
    private String baseUrl;

    private final RestClient restClient = RestClient.builder().build();

    @Override
    public Optional<BigDecimal> fetchPrice(String ticker) {
        String normalized = ticker.trim().toLowerCase(Locale.ROOT);
        return fetchRaw(normalized).or(() -> fetchRaw(normalized + ".us"));
    }

    private Optional<BigDecimal> fetchRaw(String symbol) {
        try {
            String csv = restClient.get()
                    .uri(baseUrl + "?s={symbol}&f=sd2t2ohlcv&h&e=csv", symbol)
                    .retrieve()
                    .body(String.class);
            if (csv == null) return Optional.empty();

            String[] lines = csv.strip().split("\\r?\\n");
            if (lines.length < 2) return Optional.empty();

            String[] fields = lines[1].split(",");
            if (fields.length < 7) return Optional.empty();

            String close = fields[6].trim();
            if (close.isEmpty() || close.equalsIgnoreCase("N/D")) return Optional.empty();

            return Optional.of(new BigDecimal(close));
        } catch (Exception e) {
            log.warn("Price lookup failed for '{}': {}", symbol, e.getMessage());
            return Optional.empty();
        }
    }
}
