package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.PortfolioImportResult;
import de.baier.familyadmin.dto.PortfolioPositionRequest;
import de.baier.familyadmin.dto.PortfolioRequest;
import de.baier.familyadmin.dto.PortfolioResponse;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.PortfolioRepository;
import de.baier.familyadmin.repository.PortfolioShareRepository;
import de.baier.familyadmin.repository.PortfolioValueSnapshotRepository;
import de.baier.familyadmin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PortfolioService {

    private final PortfolioRepository portfolioRepository;
    private final PortfolioShareRepository portfolioShareRepository;
    private final PortfolioValueSnapshotRepository portfolioValueSnapshotRepository;
    private final UserRepository userRepository;
    private final PortfolioImportService portfolioImportService;
    private final StockPriceService stockPriceService;
    private final ClaudeAnalysisService claudeAnalysisService;
    private final PortfolioNotificationService portfolioNotificationService;
    private final DocumentService documentService;
    private final JdbcTemplate jdbcTemplate;

    /** Portfolios owned by, or shared with, the given user — every user only ever sees their own. */
    @Transactional(readOnly = true)
    public List<Portfolio> getAllVisibleTo(User currentUser) {
        return portfolioRepository.findAllVisibleToUser(currentUser.getId());
    }

    /** Internal lookup, no access check — used by the scheduler and owner-gated operations below. */
    @Transactional(readOnly = true)
    public Portfolio getById(UUID id) {
        return portfolioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Portfolio not found: " + id));
    }

    /** Lookup for a specific viewer — requires the portfolio to be owned by, or shared with, them. */
    @Transactional(readOnly = true)
    public Portfolio getViewableById(UUID id, User currentUser) {
        var portfolio = getById(id);
        requireViewAccess(portfolio, currentUser);
        return portfolio;
    }

    public Portfolio createPortfolio(PortfolioRequest req, User currentUser) {
        var portfolio = Portfolio.builder()
                .name(req.name())
                .createdBy(currentUser)
                .build();
        return portfolioRepository.save(portfolio);
    }

    public void deletePortfolio(UUID id, User currentUser) {
        var portfolio = getById(id);
        requireOwnerOrAdmin(portfolio, currentUser);
        portfolioRepository.delete(portfolio);
    }

    public Portfolio addPosition(UUID portfolioId, PortfolioPositionRequest req, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        var position = PortfolioPosition.builder()
                .portfolio(portfolio)
                .ticker(req.ticker().toUpperCase())
                .name(req.name())
                .shares(req.shares())
                .purchasePrice(req.purchasePrice())
                .purchaseDate(req.purchaseDate())
                .build();
        portfolio.getPositions().add(position);
        return portfolioRepository.save(portfolio);
    }

    public Portfolio updatePosition(UUID portfolioId, UUID positionId, PortfolioPositionRequest req, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        var position = portfolio.getPositions().stream()
                .filter(p -> p.getId().equals(positionId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Position not found: " + positionId));
        position.setTicker(req.ticker().toUpperCase());
        position.setName(req.name());
        position.setShares(req.shares());
        position.setPurchasePrice(req.purchasePrice());
        position.setPurchaseDate(req.purchaseDate());
        return portfolioRepository.save(portfolio);
    }

    public void deletePosition(UUID portfolioId, UUID positionId, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        boolean removed = portfolio.getPositions().removeIf(p -> p.getId().equals(positionId));
        if (!removed) {
            throw new ResourceNotFoundException("Position not found: " + positionId);
        }
        portfolioRepository.save(portfolio);
    }

    public PortfolioImportResult importFile(UUID portfolioId, MultipartFile file, User currentUser) throws IOException {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);

        var parseResult = portfolioImportService.parse(file);
        for (var row : parseResult.rows()) {
            var position = PortfolioPosition.builder()
                    .portfolio(portfolio)
                    .ticker(row.ticker())
                    .name(row.name())
                    .shares(row.shares())
                    .purchasePrice(row.purchasePrice())
                    .purchaseDate(row.purchaseDate())
                    .build();
            portfolio.getPositions().add(position);
        }
        portfolio = portfolioRepository.save(portfolio);

        var document = documentService.store(file, currentUser, DocumentSource.UPLOAD,
                null, "finance", "portfolio-import", null);
        jdbcTemplate.update(
                "INSERT INTO portfolio_documents (portfolio_id, document_id) VALUES (?, ?)",
                portfolio.getId(), document.getId());

        refreshPrices(portfolio.getId(), currentUser);
        portfolio = getById(portfolio.getId());

        return new PortfolioImportResult(parseResult.rows().size(), parseResult.warnings(),
                PortfolioResponse.from(portfolio));
    }

    public Portfolio refreshPrices(UUID portfolioId, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        return doRefreshPrices(portfolio);
    }

    /** No access check — for the weekly scheduler, which iterates every portfolio regardless of caller. */
    public Portfolio refreshPrices(UUID portfolioId) {
        return doRefreshPrices(getById(portfolioId));
    }

    private Portfolio doRefreshPrices(Portfolio portfolio) {
        for (PortfolioPosition position : portfolio.getPositions()) {
            stockPriceService.fetchPrice(position.getTicker()).ifPresent(price -> {
                position.setCurrentPrice(price);
                position.setCurrentValue(price.multiply(position.getShares()));
                position.setPriceUpdatedAt(Instant.now());
            });
        }
        var saved = portfolioRepository.save(portfolio);
        recordSnapshot(saved);
        return saved;
    }

    /** One value point per portfolio per day — repeated refreshes on the same day update, not duplicate. */
    private void recordSnapshot(Portfolio portfolio) {
        BigDecimal totalValue = portfolio.getPositions().stream()
                .map(p -> p.getCurrentValue() != null ? p.getCurrentValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        LocalDate today = LocalDate.now();

        var snapshot = portfolioValueSnapshotRepository
                .findByPortfolioIdAndSnapshotDate(portfolio.getId(), today)
                .orElseGet(() -> PortfolioValueSnapshot.builder()
                        .portfolio(portfolio)
                        .snapshotDate(today)
                        .totalValue(BigDecimal.ZERO)
                        .build());
        snapshot.setTotalValue(totalValue);
        portfolioValueSnapshotRepository.save(snapshot);
    }

    /** Full value history for charting/period comparisons — same view access as the portfolio itself. */
    @Transactional(readOnly = true)
    public List<PortfolioValueSnapshot> getSnapshots(UUID portfolioId, User currentUser) {
        var portfolio = getById(portfolioId);
        requireViewAccess(portfolio, currentUser);
        return portfolioValueSnapshotRepository.findByPortfolioIdOrderBySnapshotDateAsc(portfolioId);
    }

    public PortfolioAnalysis runAnalysis(UUID portfolioId, AnalysisType type, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        return doRunAnalysis(portfolio, type);
    }

    /** No access check — for the weekly scheduler. */
    public PortfolioAnalysis runAnalysis(UUID portfolioId, AnalysisType type) {
        return doRunAnalysis(getById(portfolioId), type);
    }

    private PortfolioAnalysis doRunAnalysis(Portfolio portfolio, AnalysisType type) {
        String content = claudeAnalysisService.analyze(portfolio, type);

        var analysis = PortfolioAnalysis.builder()
                .portfolio(portfolio)
                .analysisType(type)
                .content(content)
                .build();
        portfolio.getAnalyses().add(analysis);
        portfolioRepository.save(portfolio);

        var saved = portfolio.getAnalyses().get(portfolio.getAnalyses().size() - 1);
        portfolioNotificationService.notifyAnalysisReady(portfolio, saved);
        return saved;
    }

    public Portfolio shareWith(UUID portfolioId, UUID userId, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        var target = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        if (target.getId().equals(portfolio.getCreatedBy().getId())) {
            throw new IllegalArgumentException("Portfolio owner already has access");
        }
        if (!portfolioShareRepository.existsByPortfolioIdAndUserId(portfolioId, userId)) {
            portfolio.getShares().add(PortfolioShare.builder().portfolio(portfolio).user(target).build());
            portfolioRepository.save(portfolio);
        }
        return getById(portfolioId);
    }

    public Portfolio revokeShare(UUID portfolioId, UUID userId, User currentUser) {
        var portfolio = getById(portfolioId);
        requireOwnerOrAdmin(portfolio, currentUser);
        portfolioShareRepository.deleteByPortfolioIdAndUserId(portfolioId, userId);
        return getById(portfolioId);
    }

    private void requireViewAccess(Portfolio portfolio, User user) {
        boolean isOwner = portfolio.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isSharedWith = portfolio.getShares().stream()
                .anyMatch(s -> s.getUser().getId().equals(user.getId()));
        if (!isOwner && !isAdmin && !isSharedWith) {
            throw new AccessDeniedException("You don't have access to this portfolio");
        }
    }

    private void requireOwnerOrAdmin(Portfolio portfolio, User user) {
        boolean isOwner = portfolio.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You don't have permission to modify this portfolio");
        }
    }
}
