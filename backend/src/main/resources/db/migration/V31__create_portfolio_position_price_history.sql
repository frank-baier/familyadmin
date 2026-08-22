CREATE TABLE portfolio_position_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    price NUMERIC(14, 2) NOT NULL,
    value NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (position_id, snapshot_date)
);

CREATE INDEX idx_portfolio_position_price_history_position_id ON portfolio_position_price_history(position_id);
