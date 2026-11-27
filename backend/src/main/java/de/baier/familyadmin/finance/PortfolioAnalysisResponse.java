package de.baier.familyadmin.finance;

  
import java.time.Instant;
import java.util.UUID;

public record PortfolioAnalysisResponse(
        UUID id,
        AnalysisType analysisType,
        String content,
        Instant createdAt
) {
    public static PortfolioAnalysisResponse from(PortfolioAnalysis a) {
        return new PortfolioAnalysisResponse(a.getId(), a.getAnalysisType(), a.getContent(), a.getCreatedAt());
    }
}
