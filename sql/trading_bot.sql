-- Trading Bot Database Schema
-- Run this in your PostgreSQL database

-- Users table (extends your existing profiles table)
CREATE TABLE IF NOT EXISTS trading_users (
    id UUID REFERENCES profiles(id) PRIMARY KEY,
    subscription_tier TEXT DEFAULT 'basic', -- 'basic' | 'pro' | 'elite'
    telegram_chat_id TEXT,
    encryption_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Exchange API keys (encrypted)
CREATE TABLE IF NOT EXISTS exchange_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES trading_users(id) ON DELETE CASCADE,
    exchange_id TEXT NOT NULL, -- 'binance', 'coinbase', etc.
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bot settings per user
CREATE TABLE IF NOT EXISTS bot_settings (
    user_id UUID REFERENCES trading_users(id) PRIMARY KEY,
    max_position_size DECIMAL DEFAULT 0.02, -- 2% of portfolio
    auto_trade BOOLEAN DEFAULT FALSE,
    paper_trading BOOLEAN DEFAULT TRUE,
    enabled_pairs TEXT[] DEFAULT '{}', -- e.g., '{BTC/USDT,ETH/USDT}'
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trade history
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES trading_users(id),
    exchange_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL, -- 'buy' | 'sell'
    order_type TEXT NOT NULL, -- 'limit' | 'market' | 'stop_loss' | 'take_profit'
    quantity DECIMAL NOT NULL,
    price DECIMAL NOT NULL,
    signal TEXT, -- 'STRONG BUY' | 'BUY' etc.
    entry_price DECIMAL,
    exit_price DECIMAL,
    pnl DECIMAL, -- Profit/Loss
    status TEXT DEFAULT 'open', -- 'open' | 'closed' | 'cancelled'
    order_id TEXT, -- Exchange order ID
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Performance tracking
CREATE TABLE IF NOT EXISTS bot_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES trading_users(id),
    month DATE NOT NULL,
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    total_pnl DECIMAL DEFAULT 0,
    win_rate DECIMAL GENERATED ALWAYS AS (
        CASE WHEN total_trades > 0 THEN (winning_trades::DECIMAL / total_trades) * 100 ELSE 0 END
    ) STORED,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES trading_users(id),
    type TEXT NOT NULL, -- 'trade_alert' | 'error' | 'info'
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_exchange_keys_user_id ON exchange_keys(user_id);
