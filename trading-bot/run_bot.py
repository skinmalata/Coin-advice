#!/usr/bin/env python3
"""
CoinAdvice Trading Bot - Standalone Orchestrator
Runs 24/7, executing trades based on CoinAdvice signals.
"""
import os
import sys
import time
from datetime import datetime
from core.bot import TradingBot
import json
import glob

DATA_DIR = "trading-bot/data"

def read_json(filename):
    """Read JSON database file."""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r') as f:
        return json.load(f)

def get_active_bots():
    """Fetch all users with active trading bots."""
    users = read_json("users.json")
    keys = read_json("exchange_keys.json")
    settings = read_json("bot_settings.json")
    
    active_bots = []
    
    for user in users:
        # Find user's settings
        user_settings = next((s for s in settings if s['user_id'] == user['id']), None)
        if not user_settings or not user_settings.get('auto_trade'):
            continue
        
        # Find user's exchange key
        user_key = next((k for k in keys if k['user_id'] == user['id'] and k.get('is_enabled')), None)
        if not user_key:
            continue
        
        active_bots.append({
            'user_id': user['id'],
            'subscription_tier': user.get('subscription_tier', 'basic'),
            'telegram_chat_id': user.get('telegram_chat_id'),
            'encryption_key': user['encryption_key'],
            'exchange_id': user_key['exchange_id'],
            'api_key_encrypted': user_key['api_key_encrypted'],
            'api_secret_encrypted': user_key['api_secret_encrypted'],
            'auto_trade': user_settings['auto_trade'],
            'paper_trading': user_settings['paper_trading'],
            'enabled_pairs': user_settings.get('enabled_pairs', []),
            'max_position_size': user_settings.get('max_position_size', 0.02)
        })
    
    return active_bots

def run_bot_instance(bot_config):
    """Run a single bot instance."""
    try:
        # Create bot instance
        bot = TradingBot(
            bot_config['user_id'],
            bot_config['exchange_id'],
            bot_config['api_key_encrypted'],
            bot_config['api_secret_encrypted'],
            bot_config['encryption_key']
        )
        
        # Apply user settings
        bot.auto_trade = bot_config['auto_trade']
        bot.paper_trading = bot_config['paper_trading']
        bot.max_position_size = float(bot_config['max_position_size'])
        bot.enabled_pairs = bot_config['enabled_pairs']
        
        # Check and execute trades
        results = bot.check_and_execute()
        
        # Log results
        if results:
            notifications = read_json("notifications.json")
            for result in results:
                notifications.append({
                    "user_id": bot_config['user_id'],
                    "type": "trade_alert",
                    "message": str(result),
                    "sent_at": datetime.now().isoformat()
                })
            with open(os.path.join(DATA_DIR, "notifications.json"), 'w') as f:
                json.dump(notifications, f, indent=2)
        
        return results
    except Exception as e:
        print(f"Error running bot for user {bot_config['user_id']}: {e}")
        return None

def main():
    """Main loop - runs every 60 seconds."""
    print(f"🤖 CoinAdvice Trading Bot Started at {datetime.now()}")
    print("=" * 60)
    
    # Verify environment variables
    if not os.getenv("BOT_TOKEN"):
        print("❌ Missing BOT_TOKEN environment variable")
        sys.exit(1)
    
    while True:
        try:
            print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking for trading opportunities...")
            
            # Get all active bots
            active_bots = get_active_bots()
            print(f"Found {len(active_bots)} active bot(s)")
            
            # Run each bot
            for bot_config in active_bots:
                tier = bot_config['subscription_tier']
                print(f"\n▶️  Running bot for user {bot_config['user_id'][:8]}... (Tier: {tier})")
                
                # Check tier limits
                if tier == 'basic' and len(bot_config['enabled_pairs']) > 3:
                    print(f"⚠️  Basic tier limited to 3 pairs. User has {len(bot_config['enabled_pairs'])}")
                    continue
                elif tier == 'pro' and len(bot_config['enabled_pairs']) > 10:
                    print(f"⚠️  Pro tier limited to 10 pairs. User has {len(bot_config['enabled_pairs'])}")
                    continue
                
                results = run_bot_instance(bot_config)
                if results:
                    print(f"✅ Processed {len(results)} signal(s)")
                else:
                    print("ℹ️  No actions taken")
            
            # Sleep for 60 seconds
            print(f"\n⏰ Waiting 60 seconds until next check...")
            time.sleep(60)
            
        except KeyboardInterrupt:
            print("\n\n🛑 Bot stopped by user")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ Error in main loop: {e}")
            time.sleep(60)  # Wait before retrying

if __name__ == "__main__":
    main()
