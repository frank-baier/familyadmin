package de.baier.familyadmin.service;

import java.math.BigDecimal;
import java.util.Optional;

public interface CurrencyConversionService {
    /** Exchange rate to multiply an amount in `from` by, to get its value in `to`. Empty if unavailable. */
    Optional<BigDecimal> getRate(String from, String to);
}
