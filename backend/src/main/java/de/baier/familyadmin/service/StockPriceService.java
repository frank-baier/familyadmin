package de.baier.familyadmin.service;

import java.math.BigDecimal;
import java.util.Optional;

public interface StockPriceService {
    /**
     * Fetches the latest known price for a ticker. Empty if the ticker is unknown
     * or the price source is unavailable.
     */
    Optional<BigDecimal> fetchPrice(String ticker);
}
