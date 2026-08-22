package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Free, key-less FX rates via the Frankfurter API (ECB reference rates, daily).
 * Rates are cached per currency pair for a few hours — a portfolio refresh loops over
 * every position, and same-currency positions (e.g. several USD stocks) shouldn't each
 * trigger their own network call.
 */
@Slf4j
@Service
public class FrankfurterCurrencyConversionService implements CurrencyConversionService {

    private static final Duration CACHE_TTL = Duration.ofHours(6);

    private record CachedRate(BigDecimal rate, Instant fetchedAt) {}

    @Value("${frankfurter.base-url:https://api.frankfurter.dev/v1}")
    private String baseUrl;

    private final RestClient restClient = RestClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, CachedRate> cache = new ConcurrentHashMap<>();

    @Override
    public Optional<BigDecimal> getRate(String from, String to) {
        if (from.equalsIgnoreCase(to)) return Optional.of(BigDecimal.ONE);

        String key = from.toUpperCase() + "->" + to.toUpperCase();
        CachedRate cached = cache.get(key);
        if (cached != null && Duration.between(cached.fetchedAt(), Instant.now()).compareTo(CACHE_TTL) < 0) {
            return Optional.of(cached.rate());
        }

        try {
            String body = restClient.get()
                    .uri(baseUrl + "/latest?from={from}&to={to}", from, to)
                    .retrieve()
                    .body(String.class);
            if (body == null) return Optional.empty();

            JsonNode rateNode = objectMapper.readTree(body).path("rates").path(to.toUpperCase());
            if (rateNode.isMissingNode()) return Optional.empty();

            BigDecimal rate = BigDecimal.valueOf(rateNode.asDouble());
            cache.put(key, new CachedRate(rate, Instant.now()));
            return Optional.of(rate);
        } catch (Exception e) {
            log.warn("FX rate lookup failed for {}->{}: {}", from, to, e.getMessage());
            return Optional.empty();
        }
    }
}
