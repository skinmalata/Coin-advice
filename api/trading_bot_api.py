from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json

app = FastAPI(title="CoinAdvice Trading Bot API")

# Database connection
def get_db():
    conn = psycopg2.connect(
        os.getenv("DATABASE_URL"),
        cursor_factory=RealDictCursor
    )
    try:
        yield conn
    finally:
        conn.close()

# Security
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_current_user(api_key: str = Security(api_key_header)):
    # Verify API key and return user_id
    # (Implement your auth logic here)
    return {"user_id": "user-123", "tier": "pro"}

# Models
class ExchangeKeyCreate(BaseModel):
    exchange_id: str
    api_key: str
    api_secret: str

class BotSettingsUpdate(BaseModel):
    max_position_size: Optional[float] = None
    auto_trade: Optional[bool] = None
    paper_trading: Optional[bool] = None
    enabled_pairs: Optional[List[str]] = None

class TradeAction(BaseModel):
    symbol: str
    action: str  # 'buy' or 'sell'

# Endpoints
@app.get("/api/v1/trading/status")
async def get_bot_status(user=Depends(get_current_user), db=Depends(get_db)):
    """Get bot status for the user."""
    cursor = db.cursor()
    cursor.execute("""
        SELECT ts.*, tu.subscription_tier
        FROM bot_settings ts
        JOIN trading_users tu ON ts.user_id = tu.id
        WHERE ts.user_id = %s
    """, (user['user_id'],))
    
    settings = cursor.fetchone()
    if not settings:
        raise HTTPException(status_code=404, detail="Bot not configured")
    
    return settings

@app.post("/api/v1/trading/exchange-keys")
async def add_exchange_key(data: ExchangeKeyCreate, user=Depends(get_current_user), db=Depends(get_db)):
    """Add or update exchange API keys."""
    from trading_bot import TradingBot
    
    # Encrypt credentials
    encryption_key = os.getenv("ENCRYPTION_KEY")  # Get from user record
    encrypted_key, encrypted_secret = TradingBot.encrypt_credentials(
        data.api_key, data.api_secret, encryption_key
    )
    
    cursor = db.cursor()
    cursor.execute("""
        INSERT INTO exchange_keys (user_id, exchange_id, api_key_encrypted, api_secret_encrypted)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET
            exchange_id = EXCLUDED.exchange_id,
            api_key_encrypted = EXCLUDED.api_key_encrypted,
            api_secret_encrypted = EXCLUDED.api_secret_encrypted
    """, (user['user_id'], data.exchange_id, encrypted_key, encrypted_secret))
    
    db.commit()
    return {"status": "success", "message": "Exchange keys added"}

@app.put("/api/v1/trading/settings")
async def update_settings(data: BotSettingsUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    """Update bot settings."""
    cursor = db.cursor()
    
    updates = []
    params = [user['user_id']]
    
    if data.max_position_size is not None:
        updates.append("max_position_size = %s")
        params.append(data.max_position_size)
    if data.auto_trade is not None:
        updates.append("auto_trade = %s")
        params.append(data.auto_trade)
    if data.paper_trading is not None:
        updates.append("paper_trading = %s")
        params.append(data.paper_trading)
    if data.enabled_pairs is not None:
        updates.append("enabled_pairs = %s")
        params.append(data.enabled_pairs)
    
    updates.append("updated_at = NOW()")
    
    query = f"""
        UPDATE bot_settings SET {', '.join(updates)}
        WHERE user_id = %s
    """
    params.append(user['user_id'])
    
    cursor.execute(query, params)
    db.commit()
    
    return {"status": "success", "message": "Settings updated"}

@app.get("/api/v1/trading/trades")
async def get_trades(status: Optional[str] = None, limit: int = 50, user=Depends(get_current_user), db=Depends(get_db)):
    """Get trade history."""
    cursor = db.cursor()
    
    query = "SELECT * FROM trades WHERE user_id = %s"
    params = [user['user_id']]
    
    if status:
        query += " AND status = %s"
        params.append(status)
    
    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)
    
    cursor.execute(query, params)
    trades = cursor.fetchall()
    
    return trades

@app.post("/api/v1/trading/action")
async def execute_trade_action(data: TradeAction, user=Depends(get_current_user), db=Depends(get_db)):
    """Manually execute a trade action."""
    cursor = db.cursor()
    
    # Get user's bot instance
    cursor.execute("""
        SELECT ek.*, tu.encryption_key
        FROM exchange_keys ek
        JOIN trading_users tu ON ek.user_id = tu.id
        WHERE ek.user_id = %s AND ek.is_enabled = TRUE
    """, (user['user_id'],))
    
    key_data = cursor.fetchone()
    if not key_data:
        raise HTTPException(status_code=400, detail="No exchange configured")
    
    from trading_bot import TradingBot
    bot = TradingBot(
        user['user_id'],
        key_data['exchange_id'],
        key_data['api_key_encrypted'],
        key_data['api_secret_encrypted'],
        key_data['encryption_key']
    )
    
    # Get signal
    signal = bot.get_signal(data.symbol)
    if not signal:
        raise HTTPException(status_code=400, detail="Could not get signal")
    
    if data.action == 'buy' and signal['signal'] in ['STRONG BUY', 'BUY']:
        result = bot.place_buy_order(data.symbol, signal)
        return {"status": "success", "result": result}
    else:
        return {"status": "info", "message": f"Signal is {signal['signal']}, not a buy signal"}

@app.get("/api/v1/trading/performance")
async def get_performance(user=Depends(get_current_user), db=Depends(get_db)):
    """Get bot performance stats."""
    cursor = db.cursor()
    cursor.execute("""
        SELECT * FROM bot_performance
        WHERE user_id = %s
        ORDER BY month DESC
    """, (user['user_id'],))
    
    performance = cursor.fetchall()
    return performance

@app.post("/api/v1/trading/emergency-stop")
async def emergency_stop(user=Depends(get_current_user), db=Depends(get_db)):
    """Emergency stop: cancel all orders and close positions."""
    cursor = db.cursor()
    
    # Get user's exchange
    cursor.execute("""
        SELECT ek.*, tu.encryption_key
        FROM exchange_keys ek
        JOIN trading_users tu ON ek.user_id = tu.id
        WHERE ek.user_id = %s AND ek.is_enabled = TRUE
    """, (user['user_id'],))
    
    key_data = cursor.fetchone()
    if not key_data:
        raise HTTPException(status_code=400, detail="No exchange configured")
    
    from trading_bot import TradingBot
    bot = TradingBot(
        user['user_id'],
        key_data['exchange_id'],
        key_data['api_key_encrypted'],
        key_data['api_secret_encrypted'],
        key_data['encryption_key']
    )
    
    # Cancel all open orders
    try:
        bot.exchange.cancel_all_orders()
        return {"status": "success", "message": "All orders cancelled"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
