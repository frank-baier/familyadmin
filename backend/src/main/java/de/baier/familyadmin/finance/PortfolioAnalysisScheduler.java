package de.baier.familyadmin.finance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PortfolioAnalysisScheduler {

    private final PortfolioRepository portfolioRepository;
    private final PortfolioService portfolioService;

    @Scheduled(cron = "0 0 9 * * FRI")
    public void runWeeklyAnalyses() {
        var portfolios = portfolioRepository.findAllByOrderByNameAsc();
        log.info("Running weekly portfolio analysis for {} portfolio(s)", portfolios.size());

        for (Portfolio portfolio : portfolios) {
            try {
                portfolioService.refreshPrices(portfolio.getId());
                portfolioService.runAnalysis(portfolio.getId(), AnalysisType.WEEKLY);
            } catch (Exception e) {
                log.error("Weekly analysis failed for portfolio {}: {}", portfolio.getId(), e.getMessage());
            }
        }
    }
}
