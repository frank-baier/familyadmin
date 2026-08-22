package de.baier.familyadmin.service;

import java.math.BigDecimal;
import java.util.Optional;

public interface StockPriceService {

    record PriceQuote(BigDecimal price, String currency) {}

    /**
     * Fetches the latest known price for a ticker, in its native trading currency.
     * Empty if the ticker is unknown or the price source is unavailable.
     */
    Optional<PriceQuote> fetchPrice(String ticker);
}
