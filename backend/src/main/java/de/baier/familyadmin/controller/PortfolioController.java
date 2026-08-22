package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.*;
import de.baier.familyadmin.model.AnalysisType;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PortfolioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/portfolios")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;

    @GetMapping
    public ResponseEntity<List<PortfolioResponse>> getAll(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(portfolioService.getAllVisibleTo(currentUser).stream()
                .map(PortfolioResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PortfolioResponse> getById(@PathVariable UUID id,
                                                      @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(PortfolioResponse.from(portfolioService.getViewableById(id, currentUser)));
    }

    @GetMapping("/{id}/snapshots")
    public ResponseEntity<List<PortfolioSnapshotResponse>> getSnapshots(@PathVariable UUID id,
                                                                        @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(portfolioService.getSnapshots(id, currentUser).stream()
                .map(PortfolioSnapshotResponse::from).toList());
    }

    @GetMapping("/{id}/performance")
    public ResponseEntity<PortfolioPerformanceResponse> getPerformance(@PathVariable UUID id,
                                                                        @RequestParam LocalDate since,
                                                                        @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(portfolioService.getPerformance(id, since, currentUser));
    }

    @PostMapping
    public ResponseEntity<PortfolioResponse> create(@Valid @RequestBody PortfolioRequest request,
                                                     @AuthenticationPrincipal User currentUser) {
        var portfolio = portfolioService.createPortfolio(request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/portfolios/" + portfolio.getId()))
                .body(PortfolioResponse.from(portfolio));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        portfolioService.deletePortfolio(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/positions")
    public ResponseEntity<PortfolioResponse> addPosition(@PathVariable UUID id,
                                                          @Valid @RequestBody PortfolioPositionRequest request,
                                                          @AuthenticationPrincipal User currentUser) {
        var portfolio = portfolioService.addPosition(id, request, currentUser);
        return ResponseEntity.ok(PortfolioResponse.from(portfolio));
    }

    @PutMapping("/{id}/positions/{positionId}")
    public ResponseEntity<PortfolioResponse> updatePosition(@PathVariable UUID id, @PathVariable UUID positionId,
                                                             @Valid @RequestBody PortfolioPositionRequest request,
                                                             @AuthenticationPrincipal User currentUser) {
        var portfolio = portfolioService.updatePosition(id, positionId, request, currentUser);
        return ResponseEntity.ok(PortfolioResponse.from(portfolio));
    }

    @DeleteMapping("/{id}/positions/{positionId}")
    public ResponseEntity<Void> deletePosition(@PathVariable UUID id, @PathVariable UUID positionId,
                                               @AuthenticationPrincipal User currentUser) {
        portfolioService.deletePosition(id, positionId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/import")
    public ResponseEntity<PortfolioImportResult> importFile(@PathVariable UUID id,
                                                             @RequestParam("file") MultipartFile file,
                                                             @AuthenticationPrincipal User currentUser) throws IOException {
        return ResponseEntity.ok(portfolioService.importFile(id, file, currentUser));
    }

    @PostMapping("/{id}/refresh-prices")
    public ResponseEntity<PortfolioResponse> refreshPrices(@PathVariable UUID id,
                                                            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(PortfolioResponse.from(portfolioService.refreshPrices(id, currentUser)));
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<PortfolioAnalysisResponse> analyze(@PathVariable UUID id,
                                                              @RequestParam(defaultValue = "ON_DEMAND") AnalysisType type,
                                                              @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(PortfolioAnalysisResponse.from(portfolioService.runAnalysis(id, type, currentUser)));
    }

    @PutMapping("/{id}/shares/{userId}")
    public ResponseEntity<PortfolioResponse> shareWith(@PathVariable UUID id, @PathVariable UUID userId,
                                                        @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(PortfolioResponse.from(portfolioService.shareWith(id, userId, currentUser)));
    }

    @DeleteMapping("/{id}/shares/{userId}")
    public ResponseEntity<PortfolioResponse> revokeShare(@PathVariable UUID id, @PathVariable UUID userId,
                                                          @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(PortfolioResponse.from(portfolioService.revokeShare(id, userId, currentUser)));
    }
}
