CREATE TABLE portfolio_value_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_value NUMERIC(16, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX idx_portfolio_value_snapshots_portfolio_id ON portfolio_value_snapshots(portfolio_id);
