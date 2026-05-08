from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from datetime import datetime

app = FastAPI(title="CoinAdvice Trading Bot API", version="1.0")

# Data directory
DATA_DIR = "trading-bot/data"

def read_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r') as f:
        return json.load(f)

def write_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Security
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_current_user(api_key: str = Security(api_key_header)):
    users = read_json("users.json")
    user = next((u for u in users if u.get('api_key') == api_key), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return user

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
@app.get("/api/v1/status")
async def get_status(user=Depends(get_current_user)):
    settings = read_json("bot_settings.json")
    user_settings = next((s for s in settings if s['user_id'] == user['id']), None)
    if not user_settings:
        raise HTTPException(status_code=404, detail="Bot not configured")
    return user_settings

@app.post("/api/v1/exchange-keys")
async def add_exchange_key(data: ExchangeKeyCreate, user=Depends(get_current_user)):
    from core.bot import TradingBot
    
    # Encrypt credentials
    encryption_key = user['encryption_key']
    encrypted_key, encrypted_secret = TradingBot.encrypt_credentials(
        data.api_key, data.api_secret, encryption_key
    )
    
    keys = read_json("exchange_keys.json")
    # Remove old key if exists
    keys = [k for k in keys if k['user_id'] != user['id']]
    keys.append({
        "user_id": user['id'],
        "exchange_id": data.exchange_id,
        "api_key_encrypted": encrypted_key,
        "api_secret_encrypted": encrypted_secret,
        "is_enabled": True,
        "created_at": datetime.now().isoformat()
    })
    write_json("exchange_keys.json", keys)
    
    return {"status": "success", "message": "Exchange keys added"}

@app.put("/api/v1/settings")
async def update_settings(data: BotSettingsUpdate, user=Depends(get_current_user)):
    settings = read_json("bot_settings.json")
    user_settings = next((s for s in settings if s['user_id'] == user['id']), None)
    
    if not user_settings:
        user_settings = {"user_id": user['id']}
        settings.append(user_settings)
    
    if data.max_position_size is not None:
        user_settings['max_position_size'] = data.max_position_size
    if data.auto_trade is not None:
        user_settings['auto_trade'] = data.auto_trade
    if data.paper_trading is not None:
        user_settings['paper_trading'] = data.paper_trading
    if data.enabled_pairs is not None:
        user_settings['enabled_pairs'] = data.enabled_pairs
    
    user_settings['updated_at'] = datetime.now().isoformat()
    write_json("bot_settings.json", settings)
    
    return {"status": "success", "message": "Settings updated"}

@app.get("/api/v1/trades")
async def get_trades(user=Depends(get_current_user)):
    trades = read_json("trades.json")
    user_trades = [t for t in trades if t['user_id'] == user['id']]
    return user_trades[:50]  # Return last 50

@app.post("/api/v1/action")
async def execute_action(data: TradeAction, user=Depends(get_current_user)):
    keys = read_json("exchange_keys.json")
    user_key = next((k for k in keys if k['user_id'] == user['id'] and k.get('is_enabled')), None)
    
    if not user_key:
        raise HTTPException(status_code=400, detail="No exchange configured")
    
    from core.bot import TradingBot
    bot = TradingBot(
        user['id'],
        user_key['exchange_id'],
        user_key['api_key_encrypted'],
        user_key['api_secret_encrypted'],
        user['encryption_key']
    )
    
    # Get signal
    signal = bot.get_signal(data.symbol)
    if not signal:
        raise HTTPException(status_code=400, detail="Could not get signal")
    
    if data.action == 'buy' and signal['signal'] in ['STRONG_BUY', 'BUY']:
        result = bot.place_buy_order(data.symbol, signal)
        return {"status": "success", "result": result}
    else:
        return {"status": "info", "message": f"Signal is {signal['signal']}"}

@app.get("/api/v1/performance")
async def get_performance(user=Depends(get_current_user)):
    trades = read_json("trades.json")
    user_trades = [t for t in trades if t['user_id'] == user['id']]
    
    total = len(user_trades)
    winning = len([t for t in user_trades if t.get('pnl', 0) > 0])
    total_pnl = sum(t.get('pnl', 0) for t in user_trades)
    
    return {
        "total_trades": total,
        "winning_trades": winning,
        "losing_trades": total - winning,
        "total_pnl": total_pnl,
        "win_rate": (winning / total * 100) if total > 0 else 0
    }

@app.post("/api/v1/emergency-stop")
async def emergency_stop(user=Depends(get_current_user)):
    keys = read_json("exchange_keys.json")
    user_key = next((k for k in keys if k['user_id'] == user['id']), None)
    
    if not user_key:
        raise HTTPException(status_code=400, detail="No exchange configured")
    
    from core.bot import TradingBot
    bot = TradingBot(
        user['id'],
        user_key['exchange_id'],
        user_key['api_key_encrypted'],
        user_key['api_secret_encrypted'],
        user['encryption_key']
    )
    
    try:
        bot.exchange.cancel_all_orders()
        return {"status": "success", "message": "All orders cancelled"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
