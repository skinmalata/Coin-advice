import ccxt
import requests
import os
import json
import time
from datetime import datetime
from cryptography.fernet import Fernet

class TradingBot:
    """Premium crypto trading bot that executes trades based on CoinAdvice signals."""
    
    def __init__(self, user_id, exchange_id, api_key, api_secret, encryption_key):
        self.user_id = user_id
        self.exchange_id = exchange_id
        self.encryption_key = encryption_key
        
        # Decrypt API credentials
        fernet = Fernet(encryption_key.encode())
        self.api_key = fernet.decrypt(api_key.encode()).decode()
        self.api_secret = fernet.decrypt(api_secret.encode()).decode()
        
        # Initialize exchange
        exchange_class = getattr(ccxt, exchange_id)
        self.exchange = exchange_class({
            'apiKey': self.api_key,
            'secret': self.api_secret,
            'enableRateLimit': True,
        })
        
        # Bot settings (loaded from DB)
        self.max_position_size = 0.02  # 2% of portfolio per trade
        self.enabled_pairs = []  # e.g., ['BTC/USDT', 'ETH/USDT']
        self.auto_trade = False
        self.paper_trading = True
        
    def get_signal(self, symbol):
        """Get trading signal from CoinAdvice website logic."""
        try:
            # Convert symbol to CoinGecko ID
            coin_id = self.symbol_to_coingecko_id(symbol)
            if not coin_id:
                return None
            
            # Fetch coin data from CoinGecko (same as bot.py)
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            coin_data = res.json()
            market_data = coin_data.get("market_data", {})
            
            price = market_data.get("current_price", {}).get("usd", 0)
            change_24h = market_data.get("price_change_percentage_24h", 0) or 0
            low_24h = market_data.get("low_24h", {}).get("usd", price * 0.98)
            
            # Generate signal (matching website logic)
            rsi = max(10, min(90, 50 + change_24h * 2.5))
            
            if change_24h > 5 and rsi < 70:
                signal = "STRONG BUY"
            elif change_24h > 2 and rsi < 65:
                signal = "BUY"
            elif change_24h < -10:
                signal = "WATCH"
            elif change_24h < 0:
                signal = "CAUTIOUS"
            else:
                signal = "HOLD"
            
            # Calculate trading levels
            entry_low = price * 0.99
            entry_high = price * 1.01
            stop_loss = low_24h * 0.97
            take_profit_1 = price * 1.08
            take_profit_2 = price * 1.15
            
            return {
                "signal": signal,
                "price": price,
                "entry_low": entry_low,
                "entry_high": entry_high,
                "stop_loss": stop_loss,
                "take_profit_1": take_profit_1,
                "take_profit_2": take_profit_2,
                "change_24h": change_24h,
                "rsi": rsi
            }
        except Exception as e:
            print(f"Error getting signal for {symbol}: {e}")
            return None
    
    def symbol_to_coingecko_id(self, symbol):
        """Convert trading pair to CoinGecko ID."""
        mapping = {
            "BTC/USDT": "bitcoin",
            "ETH/USDT": "ethereum",
            "SOL/USDT": "solana",
            "BNB/USDT": "bnb",
            "XRP/USDT": "ripple",
            "ADA/USDT": "cardano",
            "AVAX/USDT": "avalanche-2",
            "LINK/USDT": "chainlink",
            "DOT/USDT": "polkadot",
            "DOGE/USDT": "dogecoin"
        }
        return mapping.get(symbol.upper())
    
    def get_balance(self):
        """Get user's exchange balance."""
        try:
            balance = self.exchange.fetch_balance()
            return balance
        except Exception as e:
            print(f"Error fetching balance: {e}")
            return None
    
    def calculate_position_size(self, symbol, entry_price):
        """Calculate position size based on risk management."""
        try:
            balance = self.get_balance()
            if not balance:
                return None
            
            # Get USDT balance
            usdt_balance = balance.get('USDT', {}).get('free', 0)
            
            # Calculate position size (max_position_size % of portfolio)
            position_value = usdt_balance * self.max_position_size
            quantity = position_value / entry_price
            
            # Get market info for precision
            market = self.exchange.load_markets()[symbol]
            quantity = self.exchange.amount_to_precision(symbol, quantity)
            
            return float(quantity)
        except Exception as e:
            print(f"Error calculating position size: {e}")
            return None
    
    def place_buy_order(self, symbol, signal):
        """Place buy order with stop loss and take profit."""
        try:
            if not self.auto_trade:
                print(f"[PAPER] Would buy {symbol} at ${signal['price']:.2f}")
                return {"status": "paper_trade", "symbol": symbol, "price": signal['price']}
            
            # Calculate position size
            quantity = self.calculate_position_size(symbol, signal['entry_low'])
            if not quantity or quantity <= 0:
                return {"status": "error", "message": "Invalid position size"}
            
            # Place buy order
            order = self.exchange.create_limit_buy_order(
                symbol, quantity, signal['entry_high']
            )
            
            # Place stop loss order
            stop_loss_order = self.exchange.create_order(
                symbol, 'STOP_LOSS', 'sell', quantity, None,
                {'stopPrice': signal['stop_loss']}
            )
            
            # Place take profit orders
            tp1_qty = quantity * 0.5
            tp2_qty = quantity * 0.5
            
            tp1_order = self.exchange.create_limit_sell_order(
                symbol, tp1_qty, signal['take_profit_1']
            )
            tp2_order = self.exchange.create_limit_sell_order(
                symbol, tp2_qty, signal['take_profit_2']
            )
            
            return {
                "status": "success",
                "buy_order": order,
                "stop_loss": stop_loss_order,
                "take_profit_1": tp1_order,
                "take_profit_2": tp2_order
            }
        except Exception as e:
            print(f"Error placing buy order for {symbol}: {e}")
            return {"status": "error", "message": str(e)}
    
    def check_and_execute(self):
        """Main loop: check signals and execute trades."""
        results = []
        
        for symbol in self.enabled_pairs:
            signal = self.get_signal(symbol)
            if not signal:
                continue
            
            print(f"{symbol}: {signal['signal']} at ${signal['price']:.2f}")
            
            if signal['signal'] in ['STRONG BUY', 'BUY']:
                result = self.place_buy_order(symbol, signal)
                results.append({
                    "symbol": symbol,
                    "signal": signal['signal'],
                    "result": result
                })
                
                # Notify via Telegram
                self.notify_user(symbol, signal, result)
        
        return results
    
    def notify_user(self, symbol, signal, result):
        """Send Telegram notification about trade."""
        try:
            bot_token = os.getenv("BOT_TOKEN")
            chat_id = os.getenv("USER_TELEGRAM_ID")  # User's personal chat ID
            
            if not bot_token or not chat_id:
                return
            
            message = f"🤖 **Trade Alert**\n\n"
            message += f"Symbol: {symbol}\n"
            message += f"Signal: {signal['signal']}\n"
            message += f"Price: ${signal['price']:.2f}\n\n"
            
            if result['status'] == 'success':
                message += f"✅ **Order Placed**\n"
                message += f"Entry: ${signal['entry_low']:.2f} - ${signal['entry_high']:.2f}\n"
                message += f"Stop Loss: ${signal['stop_loss']:.2f}\n"
                message += f"TP1: ${signal['take_profit_1']:.2f}\n"
                message += f"TP2: ${signal['take_profit_2']:.2f}\n"
            elif result['status'] == 'paper_trade':
                message += f"📝 **Paper Trade** (No real order)\n"
            else:
                message += f"❌ **Error**: {result.get('message', 'Unknown error')}\n"
            
            requests.get(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                params={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
                timeout=10
            )
        except Exception as e:
            print(f"Error sending notification: {e}")
    
    @staticmethod
    def encrypt_credentials(api_key, api_secret, encryption_key):
        """Encrypt API credentials before storing in DB."""
        fernet = Fernet(encryption_key.encode())
        encrypted_key = fernet.encrypt(api_key.encode()).decode()
        encrypted_secret = fernet.encrypt(api_secret.encode()).decode()
        return encrypted_key, encrypted_secret
    
    @staticmethod
    def generate_encryption_key():
        """Generate a new encryption key for a user."""
        return Fernet.generate_key().decode()
