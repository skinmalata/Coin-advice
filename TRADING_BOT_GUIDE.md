# CoinAdvice Premium Trading Bot - Complete Setup Guide

## 🚀 Overview
The CoinAdvice Trading Bot automatically executes trades on your exchange based on the same signals powering coinadvice.site. It's a premium product sold as a SaaS ($29-$199/month).

## 📋 Prerequisites
- Python 3.8+
- PostgreSQL database
- Exchange account (Binance, Coinbase, Kraken, etc.)
- Telegram bot token (already have: `8730757481:AAGpu-0K5Xz8lUbSplv-pJUNkmeSeAfIonE`)
- Stripe account for subscriptions

---

## 🛠️ Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

**requirements.txt contains:**
```
requests
ccxt
psycopg2-binary
cryptography
pandas
numpy
fastapi
uvicorn
```

---

## 🗄️ Step 2: Set Up Database

1. Create a PostgreSQL database:
```bash
createdb coinadvice_trading
```

2. Run the schema:
```bash
psql coinadvice_trading < sql/trading_bot.sql
```

3. Set environment variables (create `.env` file):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/coinadvice_trading
BOT_TOKEN=8730757481:AAGpu-0K5Xz8lUbSplv-pJUNkmeSeAfIonE
ENCRYPTION_KEY=your-fernet-key-here
STRIPE_SECRET_KEY=sk_test_...
```

Generate encryption key:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

## 🔧 Step 3: Configure Your Exchange

### Important: API Key Permissions
When creating API keys on your exchange:
- ✅ Enable **Spot Trading**
- ✅ Enable **Read Info**
- ❌ Disable **Withdraw** (for security)

### Supported Exchanges
- Binance (binance)
- Coinbase Pro (coinbase)
- Kraken (kraken)
- KuCoin (kucoin)
- And 100+ more via CCXT

---

## 🖥️ Step 4: User Dashboard Setup

The dashboard is at `dashboard/trading-bot.html`. To use it:

1. **Host it** with your existing site (same domain)
2. **Users visit**: `https://coinadvice.site/dashboard/trading-bot`
3. **Connect exchange**: Enter API key/secret
4. **Configure settings**:
   - Select trading pairs (e.g., BTC/USDT, ETH/USDT)
   - Set position size (default 2% per trade)
   - Enable/disable auto-trading
   - Toggle paper trading mode

---

## 🤖 Step 5: Running the Bot

### Option A: Manual Run (Testing)
```bash
python run_trading_bot.py
```

### Option B: Production (24/7)
Use systemd (Linux) or Task Scheduler (Windows):

**Linux systemd service** (`/etc/systemd/system/coinadvice-bot.service`):
```ini
[Unit]
Description=CoinAdvice Trading Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/coinadvice
EnvironmentFile=/path/to/coinadvice/.env
ExecStart=/usr/bin/python3 /path/to/coinadvice/run_trading_bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable coinadvice-bot
sudo systemctl start coinadvice-bot
sudo systemctl status coinadvice-bot
```

---

## 📱 Step 6: Telegram Integration

Users get trade notifications via Telegram:

1. Each user starts a chat with `@followcryptoadvicebot`
2. They send `/start` to get their chat ID
3. Save their chat ID in `trading_users.telegram_chat_id`
4. Bot sends alerts for every trade:
   ```
   🤖 Trade Alert
   
   Symbol: BTC/USDT
   Signal: STRONG BUY
   Price: $67,890.12
   
   ✅ Order Placed
   Entry: $67,350 - $68,450
   Stop Loss: $65,000
   TP1: $73,000
   TP2: $78,000
   ```

---

## 💰 Step 7: Monetization (Subscription Tiers)

Update `run_trading_bot.py` to check subscription tier:

| Tier | Price | Features |
|------|-------|----------|
| **Basic** | $29/mo | 1 exchange, 3 pairs, manual approval |
| **Pro** | $79/mo | 3 exchanges, 10 pairs, auto-trade |
| **Elite** | $199/mo | Unlimited, advanced strategies |

In `get_active_bots()`:
```python
# Check tier limits
if tier == 'basic' and len(bot_config['enabled_pairs']) > 3:
    continue  # Skip this user
elif tier == 'pro' and len(bot_config['enabled_pairs']) > 10:
    continue
```

Integrate with Stripe webhooks to update `trading_users.subscription_tier`.

---

## 🛡️ Step 8: Security Best Practices

1. **Never log API secrets** - Use encryption at rest
2. **Rate limiting** - CCXT handles this, but monitor
3. **Emergency stop** - Always accessible to users
4. **Paper trading first** - Default to paper mode for new users
5. **Position sizing** - Never exceed 2% per trade (configurable)
6. **SSL/TLS** - Always use HTTPS for API

---

## 📊 Step 9: Monitoring & Logs

### Log file setup:
```python
import logging
logging.basicConfig(
    filename='trading_bot.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
```

### Monitor active bots:
```bash
tail -f trading_bot.log
```

### Database queries for monitoring:
```sql
-- Active bots
SELECT COUNT(*) FROM trading_users WHERE subscription_tier != 'basic';

-- Today's trades
SELECT * FROM trades WHERE created_at > CURRENT_DATE;

-- User P&L
SELECT user_id, SUM(pnl) as total_pnl FROM trades GROUP BY user_id;
```

---

## 🚀 Step 10: Go Live Checklist

- [ ] Database schema created
- [ ] Exchange API keys tested (paper mode)
- [ ] Telegram notifications working
- [ ] User dashboard accessible
- [ ] Stripe subscriptions configured
- [ ] Emergency stop tested
- [ ] Logs and monitoring set up
- [ ] SSL certificate installed
- [ ] Rate limits understood
- [ ] Legal disclaimers added to UI

---

## 📞 Support

For issues:
1. Check `trading_bot.log`
2. Verify API key permissions
3. Test with paper trading first
4. Monitor exchange rate limits

---

## ⚠️ Important Disclaimers

**DISPLAY THESE TO USERS:**
- "Not financial advice - bot is for informational purposes"
- "Past performance ≠ future results"
- "You can lose money trading crypto"
- "You control your API keys - we never withdraw funds"
- "Test with paper trading before using real money"

---

## 🎯 Quick Start (For Testing)

1. **Set up .env**:
```bash
export DATABASE_URL="postgresql://localhost/coinadvice_trading"
export BOT_TOKEN="8730757481:AAGpu-0K5Xz8lUbSplv-pJUNkmeSeAfIonE"
```

2. **Create test user in DB**:
```sql
INSERT INTO trading_users (id, subscription_tier, encryption_key)
VALUES ('test-user-1', 'pro', 'your-fernet-key');

INSERT INTO bot_settings (user_id, auto_trade, paper_trading, enabled_pairs)
VALUES ('test-user-1', true, true, ARRAY['BTC/USDT', 'ETH/USDT']);
```

3. **Add exchange keys** (encrypted):
```python
from trading_bot import TradingBot
enc_key = 'your-fernet-key'
api_key_enc, api_secret_enc = TradingBot.encrypt_credentials('your-api-key', 'your-api-secret', enc_key)
# Insert into exchange_keys table
```

4. **Run the bot**:
```bash
python run_trading_bot.py
```

---

**🎉 Your premium trading bot is ready! Start selling subscriptions at coinadvice.site**
