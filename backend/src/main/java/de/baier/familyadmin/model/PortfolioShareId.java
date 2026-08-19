package de.baier.familyadmin.model;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class PortfolioShareId implements Serializable {
    private UUID portfolio;
    private UUID user;

    public PortfolioShareId() {}

    public PortfolioShareId(UUID portfolio, UUID user) {
        this.portfolio = portfolio;
        this.user = user;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PortfolioShareId that)) return false;
        return Objects.equals(portfolio, that.portfolio) && Objects.equals(user, that.user);
    }

    @Override
    public int hashCode() {
        return Objects.hash(portfolio, user);
    }
}
