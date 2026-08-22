package de.baier.familyadmin.scheduler;

import de.baier.familyadmin.model.Portfolio;
import de.baier.familyadmin.repository.PortfolioRepository;
import de.baier.familyadmin.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily, free price-only refresh (Yahoo + FX lookups, no Claude cost) — separate from the
 * weekly analysis scheduler, since per-position price history needs daily points to make
 * "performance since date X" comparisons meaningful, not just a once-a-week data point.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PortfolioPriceRefreshScheduler {

    private final PortfolioRepository portfolioRepository;
    private final PortfolioService portfolioService;

    @Scheduled(cron = "0 0 7 * * *")
    public void runDailyPriceRefresh() {
        var portfolios = portfolioRepository.findAllByOrderByNameAsc();
        log.info("Running daily price refresh for {} portfolio(s)", portfolios.size());

        for (Portfolio portfolio : portfolios) {
            try {
                portfolioService.refreshPrices(portfolio.getId());
            } catch (Exception e) {
                log.error("Daily price refresh failed for portfolio {}: {}", portfolio.getId(), e.getMessage());
            }
        }
    }
}
