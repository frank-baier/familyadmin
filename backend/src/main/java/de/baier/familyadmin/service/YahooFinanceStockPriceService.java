package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Free, key-less stock/ETF price lookup via Yahoo Finance's unofficial chart API.
 * Ticker format matches Yahoo's own (e.g. "MRVL", "EUNL.DE" for Xetra-listed instruments).
 * Replaces an earlier Stooq-based implementation whose CSV endpoint now sits behind a
 * JavaScript proof-of-work challenge and is no longer reachable by a plain HTTP client.
 */
@Slf4j
@Service
public class YahooFinanceStockPriceService implements StockPriceService {

    @Value("${yahoo.finance.base-url:https://query1.finance.yahoo.com/v8/finance/chart}")
    private String baseUrl;

    private final RestClient restClient = RestClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Optional<PriceQuote> fetchPrice(String ticker) {
        try {
            String body = restClient.get()
                    .uri(baseUrl + "/{symbol}?interval=1d&range=1d", ticker.trim())
                    .header(HttpHeaders.USER_AGENT, "Mozilla/5.0")
                    .retrieve()
                    .body(String.class);
            if (body == null) return Optional.empty();

            JsonNode meta = objectMapper.readTree(body).path("chart").path("result").path(0).path("meta");
            if (!meta.has("regularMarketPrice")) return Optional.empty();

            BigDecimal price = BigDecimal.valueOf(meta.get("regularMarketPrice").asDouble());
            String currency = meta.has("currency") ? meta.get("currency").asText() : "EUR";
            return Optional.of(new PriceQuote(price, currency));
        } catch (Exception e) {
            log.warn("Price lookup failed for '{}': {}", ticker, e.getMessage());
            return Optional.empty();
        }
    }
}
