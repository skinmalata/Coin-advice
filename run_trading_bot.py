#!/usr/bin/env python3
"""
CoinAdvice Premium Trading Bot - Main Orchestrator
Runs 24/7 on a server, executing trades based on signals.
"""
import os
import sys
import time
import requests
from datetime import datetime
from trading_bot import TradingBot
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        os.getenv("DATABASE_URL"),
        cursor_factory=RealDictCursor
    )

def get_active_bots():
    """Fetch all users with active trading bots."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            tu.id as user_id,
            tu.subscription_tier,
            tu.telegram_chat_id,
            tu.encryption_key,
            ek.exchange_id,
            ek.api_key_encrypted,
            ek.api_secret_encrypted,
            bs.auto_trade,
            bs.paper_trading,
            bs.enabled_pairs,
            bs.max_position_size
        FROM trading_users tu
        JOIN exchange_keys ek ON tu.id = ek.user_id AND ek.is_enabled = TRUE
        JOIN bot_settings bs ON tu.id = bs.user_id
        WHERE bs.auto_trade = TRUE
    """)
    
    bots = cursor.fetchall()
    conn.close()
    return bots

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
        
        # Log results to database
        if results:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            for result in results:
                cursor.execute("""
                    INSERT INTO notifications (user_id, type, message)
                    VALUES (%s, 'trade_alert', %s)
                """, (bot_config['user_id'], str(result)))
            
            conn.commit()
            conn.close()
        
        return results
    except Exception as e:
        print(f"Error running bot for user {bot_config['user_id']}: {e}")
        return None

def main():
    """Main loop - runs every 60 seconds."""
    print(f"🤖 CoinAdvice Trading Bot Orchestrator Started at {datetime.now()}")
    print("=" * 60)
    
    while True:
        try:
            print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking for trading opportunities...")
            
            # Get all active bots
            active_bots = get_active_bots()
            print(f"Found {len(active_bots)} active bot(s)")
            
            # Run each bot
            for bot_config in active_bots:
                tier = bot_config['subscription_tier']
                print(f"\n▶️  Running bot for user {str(bot_config['user_id'])[:8]}... (Tier: {tier})")
                
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
            print("\n\n🛑 Bot orchestrator stopped by user")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ Error in main loop: {e}")
            time.sleep(60)  # Wait before retrying

if __name__ == "__main__":
    # Verify environment variables
    required_vars = ["DATABASE_URL", "BOT_TOKEN"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        sys.exit(1)
    
    main()
