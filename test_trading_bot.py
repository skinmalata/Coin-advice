#!/usr/bin/env python3
"""
Test script for CoinAdvice Trading Bot - Paper Trading Mode
No real money used!
"""
import os
import sys
from trading_bot import TradingBot
from datetime import datetime

# Test configuration (use test API keys or dummy values)
TEST_USER_ID = "test-user-123"
TEST_EXCHANGE = "binance"  # or "kucoin", "kraken"
TEST_API_KEY = "dummy-key-for-paper-trading"
TEST_API_SECRET = "dummy-secret-for-paper-trading"
TEST_ENCRYPTION_KEY = "test-encryption-key-123456789012345678"

def test_signal_generation():
    """Test if signals are generated correctly."""
    print("=" * 60)
    print("🧪 TEST 1: Signal Generation")
    print("=" * 60)
    
    # Create bot in paper trading mode
    bot = TradingBot(
        TEST_USER_ID,
        TEST_EXCHANGE,
        TEST_API_KEY,
        TEST_API_SECRET,
        TEST_ENCRYPTION_KEY
    )
    bot.paper_trading = True
    bot.auto_trade = False  # Don't actually trade
    
    # Test symbols
    test_symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
    
    for symbol in test_symbols:
        print(f"\n📊 Testing signal for {symbol}...")
        signal = bot.get_signal(symbol)
        
        if signal:
            print(f"   Signal: {signal['signal']}")
            print(f"   Price: ${signal['price']:.2f}")
            print(f"   Entry: ${signal['entry_low']:.2f} - ${signal['entry_high']:.2f}")
            print(f"   Stop Loss: ${signal['stop_loss']:.2f}")
            print(f"   TP1: ${signal['take_profit_1']:.2f}")
            print(f"   TP2: ${signal['take_profit_2']:.2f}")
        else:
            print(f"   ❌ No signal generated")
    
    print("\n✅ Signal generation test complete!\n")

def test_paper_trade():
    """Test paper trading (no real orders)."""
    print("=" * 60)
    print("🧪 TEST 2: Paper Trading Simulation")
    print("=" * 60)
    
    bot = TradingBot(
        TEST_USER_ID,
        TEST_EXCHANGE,
        TEST_API_KEY,
        TEST_API_SECRET,
        TEST_ENCRYPTION_KEY
    )
    bot.paper_trading = True
    bot.auto_trade = True  # Will still be paper due to paper_trading=True
    bot.enabled_pairs = ["BTC/USDT", "ETH/USDT"]
    
    print("\n🔍 Checking signals and simulating trades...\n")
    
    for symbol in bot.enabled_pairs:
        signal = bot.get_signal(symbol)
        if signal and signal['signal'] in ['STRONG BUY', 'BUY']:
            print(f"📝 Simulating trade for {symbol}:")
            print(f"   Signal: {signal['signal']}")
            result = bot.place_buy_order(symbol, signal)
            print(f"   Result: {result['status']}")
            if result['status'] == 'paper_trade':
                print(f"   ✅ Paper trade recorded (no real order)")
        else:
            print(f"⏭️  {symbol}: Signal is {signal['signal'] if signal else 'N/A'} - no trade")
    
    print("\n✅ Paper trading test complete!\n")

def test_risk_management():
    """Test risk management calculations."""
    print("=" * 60)
    print("🧪 TEST 3: Risk Management")
    print("=" * 60)
    
    bot = TradingBot(
        TEST_USER_ID,
        TEST_EXCHANGE,
        TEST_API_KEY,
        TEST_API_SECRET,
        TEST_ENCRYPTION_KEY
    )
    bot.max_position_size = 0.02  # 2%
    
    # Simulate balance
    mock_balance = {'USDT': {'free': 10000}}  # $10,000 USDT
    
    test_symbol = "BTC/USDT"
    test_price = 60000
    
    # Mock the get_balance method
    original_get_balance = bot.get_balance
    bot.get_balance = lambda: mock_balance
    
    quantity = bot.calculate_position_size(test_symbol, test_price)
    
    print(f"\n💰 Simulated Balance: ${mock_balance['USDT']['free']:,} USDT")
    print(f"📊 Max Position Size: {bot.max_position_size*100}%")
    print(f"🎯 Position Value: ${mock_balance['USDT']['free'] * bot.max_position_size:,.2f}")
    print(f"📈 BTC Price: ${test_price:,}")
    print(f"🔢 Calculated Quantity: {quantity} BTC")
    
    # Reset
    bot.get_balance = original_get_balance
    
    print("\n✅ Risk management test complete!\n")

def test_telegram_notification():
    """Test Telegram notification (optional)."""
    print("=" * 60)
    print("🧪 TEST 4: Telegram Notification")
    print("=" * 60)
    
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        print("\n⚠️  BOT_TOKEN not set. Skipping Telegram test.")
        print("   Set it with: export BOT_TOKEN='your-token'\n")
        return
    
    # Create a mock signal
    mock_signal = {
        "signal": "STRONG BUY",
        "price": 65000,
        "entry_low": 64350,
        "entry_high": 65650,
        "stop_loss": 62000,
        "take_profit_1": 70200,
        "take_profit_2": 74750
    }
    
    mock_result = {
        "status": "paper_trade",
        "symbol": "BTC/USDT",
        "price": 65000
    }
    
    print("\n📱 Sending test notification to Telegram...")
    bot = TradingBot(
        TEST_USER_ID,
        TEST_EXCHANGE,
        TEST_API_KEY,
        TEST_API_SECRET,
        TEST_ENCRYPTION_KEY
    )
    
    # Test with a dummy chat ID (replace with your Telegram chat ID)
    test_chat_id = input("Enter your Telegram chat ID (or press Enter to skip): ").strip()
    
    if test_chat_id:
        os.environ["USER_TELEGRAM_ID"] = test_chat_id
        bot.notify_user("BTC/USDT", mock_signal, mock_result)
        print("✅ Notification sent! Check your Telegram.\n")
    else:
        print("⏭️  Skipped Telegram test.\n")

def main():
    print("\n" + "=" * 60)
    print("🤖 CoinAdvice Trading Bot - Paper Trading Tests")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")
    
    print("⚠️  NO REAL MONEY WILL BE USED IN THESE TESTS\n")
    
    try:
        # Run tests
        test_signal_generation()
        test_paper_trade()
        test_risk_management()
        test_telegram_notification()
        
        print("=" * 60)
        print("🎉 ALL TESTS COMPLETE!")
        print("=" * 60)
        print("\nYour bot is ready for paper trading!")
        print("Set up your database and exchange keys to go live.\n")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
