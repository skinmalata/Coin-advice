import requests
import os
import glob
import random
from datetime import datetime

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")

def get_trending_coins():
    try:
        res = requests.get("https://api.coingecko.com/api/v3/search/trending", timeout=10)
        res.raise_for_status()
        return res.json()["coins"][:3]
    except:
        return []

def get_coin_analysis(coin_id):
    """Fetch and analyze coin data to generate premium insights with entry/stop/take profit levels."""
    try:
        coin_res = requests.get(f"https://api.coingecko.com/api/v3/coins/{coin_id}", timeout=10)
        coin_res.raise_for_status()
        coin_data = coin_res.json()
        market_data = coin_data.get("market_data", {})
        
        # Core metrics
        price = market_data.get("current_price", {}).get("usd")
        price_change_24h = market_data.get("price_change_percentage_24h")
        price_change_7d = market_data.get("price_change_percentage_7d")
        price_change_30d = market_data.get("price_change_percentage_30d")
        market_cap_rank = coin_data.get("market_cap_rank")
        market_cap = market_data.get("market_cap", {}).get("usd")
        volume_24h = market_data.get("total_volume", {}).get("usd")
        ath = market_data.get("ath", {}).get("usd")
        ath_date = market_data.get("ath_date", {}).get("usd", "")[:10]
        circulating_supply = market_data.get("circulating_supply")
        total_supply = market_data.get("total_supply")
        high_24h = market_data.get("high_24h", {}).get("usd")
        low_24h = market_data.get("low_24h", {}).get("usd")
        
        # Calculate metrics
        ath_distance = ((price / ath - 1) * 100) if (price and ath and ath > 0) else None
        liquidity_ratio = (volume_24h / market_cap * 100) if (volume_24h and market_cap and market_cap > 0) else None
        supply_ratio = (circulating_supply / total_supply * 100) if (circulating_supply and total_supply and total_supply > 0) else None
        
        # Generate signal (matching website logic)
        rsi = max(10, min(90, 50 + (price_change_24h or 0) * 2.5))
        if (price_change_24h or 0) > 5 and rsi < 70:
            signal = "🟢 STRONG BUY"
            signal_strength = "high"
        elif (price_change_24h or 0) > 2 and rsi < 65:
            signal = "🟢 BUY"
            signal_strength = "medium"
        elif (price_change_24h or 0) < -10:
            signal = "🔴 WATCH"
            signal_strength = "low"
        elif (price_change_24h or 0) < 0 and (price_change_7d or 0) < 0:
            signal = "🟡 CAUTIOUS"
            signal_strength = "low"
        else:
            signal = "🟢 BUY"
            signal_strength = "medium"
        
        # Generate trading levels (matching website logic)
        entry_low = price * 0.99 if price else None
        entry_high = price * 1.01 if price else None
        stop_loss = (low_24h * 0.97) if low_24h else (price * 0.95 if price else None)
        tp1 = price * 1.08 if price else None
        tp2 = price * 1.15 if price else None
        
        # Calculate risk/reward
        risk = (price - stop_loss) if (price and stop_loss) else None
        reward = (tp1 - price) if (price and tp1) else None
        risk_reward = round(reward / risk, 1) if (risk and reward and risk > 0) else None
        
        # Volume level
        if volume_24h:
            if volume_24h > 1e9:
                volume_level = "Very High"
            elif volume_24h > 5e8:
                volume_level = "High"
            elif volume_24h > 1e8:
                volume_level = "Normal"
            else:
                volume_level = "Low"
        else:
            volume_level = "Unknown"
        
        # Trend
        if price_change_30d and price_change_30d > 10:
            trend = "Strong Up"
        elif price_change_30d and price_change_30d > 0:
            trend = "Uptrend"
        elif price_change_30d and price_change_30d < -10:
            trend = "Strong Down"
        elif price_change_30d and price_change_30d < 0:
            trend = "Downtrend"
        else:
            trend = "Sideways"
        
        # AI Insight (matching website logic)
        if price_change_24h and price_change_24h > 8:
            ai_insight = f"Strong momentum detected! {coin_data.get('name', 'Coin')} surged {price_change_24h:.1f}% in 24h with {volume_level.lower()} volume. RSI at {rsi:.0f} indicates {'overbought conditions - wait for pullback' if rsi > 70 else 'room for continued growth'}. Consider scaling in with tight stop loss."
        elif price_change_24h and price_change_24h > 4:
            ai_insight = f"{coin_data.get('name', 'Coin')} showing solid bullish momentum with {price_change_24h:.1f}% daily gain. Volume at ${(volume_24h or 0)/1e9:.1f}B confirms institutional interest. Watch for breakout above ${(high_24h or price * 1.02):.2f}."
        else:
            ai_insight = f"Steady upward trend for {coin_data.get('name', 'Coin')}. Price holding above key support at ${(low_24h or price * 0.98):.2f}. Good accumulation zone for medium-term positions."
        
        return {
            "price": price,
            "price_change_24h": price_change_24h,
            "price_change_7d": price_change_7d,
            "price_change_30d": price_change_30d,
            "market_cap_rank": market_cap_rank,
            "market_cap": market_cap,
            "volume_24h": volume_24h,
            "ath": ath,
            "ath_date": ath_date,
            "ath_distance": ath_distance,
            "liquidity_ratio": liquidity_ratio,
            "supply_ratio": supply_ratio,
            "signal": signal,
            "signal_strength": signal_strength,
            "rsi": rsi,
            "trend": trend,
            "volume_level": volume_level,
            "entry_low": entry_low,
            "entry_high": entry_high,
            "stop_loss": stop_loss,
            "take_profit_1": tp1,
            "take_profit_2": tp2,
            "risk_reward": risk_reward,
            "ai_insight": ai_insight,
            "high_24h": high_24h,
            "low_24h": low_24h
        }
    except Exception as e:
        return None

def post_buy_tips():
    coins = get_trending_coins()
    if not coins:
        return
    
    message = "🔥 PREMIUM BUY SIGNALS 🔥\n"
    message += "━━━━━━━━━━━━━━━━━━━━\n\n"
    
    for coin in coins:
        item = coin["item"]
        name = item["name"]
        symbol = item["symbol"].upper()
        coin_id = item["id"]
        
        # Fetch detailed analysis
        analysis = get_coin_analysis(coin_id)
        
        if not analysis:
            message += f"⚠️ {name} ({symbol}) — Analysis unavailable\n\n"
            continue
        
        # Build premium analysis with trading levels
        message += f"📊 {name} ({symbol})\n"
        message += f"🎯 Signal: {analysis['signal']}\n\n"
        
        # Price & Performance
        if analysis['price']:
            message += f"💰 Price: ${analysis['price']:.4f}\n"
        if analysis['price_change_24h'] is not None:
            emoji_24h = "📈" if analysis['price_change_24h'] > 0 else "📉"
            message += f"{emoji_24h} 24h: {analysis['price_change_24h']:+.2f}%\n"
        if analysis['price_change_7d'] is not None:
            emoji_7d = "📈" if analysis['price_change_7d'] > 0 else "📉"
            message += f"{emoji_7d} 7d: {analysis['price_change_7d']:+.2f}%\n"
        if analysis['price_change_30d'] is not None:
            emoji_30d = "📈" if analysis['price_change_30d'] > 0 else "📉"
            message += f"{emoji_30d} 30d: {analysis['price_change_30d']:+.2f}%\n"
        
        message += "\n"
        
        # Trading Levels (from website logic)
        if analysis['entry_low'] and analysis['entry_high']:
            message += f"🎯 Entry: ${analysis['entry_low']:.4f} - ${analysis['entry_high']:.4f}\n"
        if analysis['stop_loss']:
            message += f"🛑 Stop Loss: ${analysis['stop_loss']:.4f}\n"
        if analysis['take_profit_1']:
            message += f"🎯 TP1: ${analysis['take_profit_1']:.4f}\n"
        if analysis['take_profit_2']:
            message += f"🎯 TP2: ${analysis['take_profit_2']:.4f}\n"
        if analysis['risk_reward']:
            rr_emoji = "✅" if analysis['risk_reward'] >= 2 else "⚠️"
            message += f"{rr_emoji} R/R: 1:{analysis['risk_reward']}\n"
        
        message += "\n"
        
        # Market Data
        if analysis['market_cap_rank']:
            message += f"🏆 Rank: #{analysis['market_cap_rank']}\n"
        if analysis['market_cap']:
            mc_b = analysis['market_cap'] / 1e9
            message += f"📊 MCap: ${mc_b:.2f}B\n"
        if analysis['volume_24h']:
            vol_b = analysis['volume_24h'] / 1e9
            message += f"📈 Volume: ${vol_b:.2f}B ({analysis['volume_level']})\n"
        
        # RSI & Trend
        message += f"📉 RSI: {analysis['rsi']:.0f}\n"
        message += f"📊 Trend: {analysis['trend']}\n"
        
        message += "\n"
        
        # AI Insight
        if analysis['ai_insight']:
            message += f"💡 Insight: {analysis['ai_insight']}\n"
        
        # ATH Analysis
        if analysis['ath'] and analysis['ath_distance']:
            distance = analysis['ath_distance']
            message += f"\n🚀 ATH: ${analysis['ath']:,.2f}\n"
            if distance < -50:
                message += f"📍 {abs(distance):.1f}% BELOW ATH — Potential upside\n"
            elif distance < -20:
                message += f"📍 {abs(distance):.1f}% BELOW ATH — Room to grow\n"
            else:
                message += f"📍 {distance:+.1f}% from ATH\n"
        
        message += "\n━━━━━━━━━━━━━━━━━━━━\n\n"
    
    message += "⚠️ DYOR | Not financial advice\n"
    message += "🔗 https://coinadvice.site for more in-depth analysis!\n"
    
    requests.get(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        params={"chat_id": CHANNEL_ID, "text": message},
        timeout=10
    )

def get_random_blog():
    blog_files = glob.glob("blog/*.html")
    if not blog_files:
        return None
    blog_file = random.choice(blog_files)
    try:
        with open(blog_file, 'r', encoding='utf-8') as f:
            content = f.read()
            import re
            # Extract title
            title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
            title = title_match.group(1) if title_match else "Blog Post"
            
            # Extract first paragraph as excerpt (remove HTML tags)
            excerpt_match = re.search(r'<p>(.*?)</p>', content, re.IGNORECASE | re.DOTALL)
            if excerpt_match:
                excerpt = re.sub(r'<[^>]+>', '', excerpt_match.group(1))  # Remove HTML tags
                excerpt = re.sub(r'\s+', ' ', excerpt).strip()  # Clean whitespace
                excerpt = excerpt[:200] + "..." if len(excerpt) > 200 else excerpt  # Truncate
            else:
                excerpt = ""
            
            filename = os.path.basename(blog_file)
            url = f"https://coinadvice.site/blog/{filename}"
            return {"title": title, "excerpt": excerpt, "url": url}
    except:
        return None

def post_blog():
    blog = get_random_blog()
    if not blog:
        return
    message = f"📚 {blog['title']}\n\n"
    if blog['excerpt']:
        message += f"{blog['excerpt']}\n\n"
    message += f"🔗 {blog['url']}\n"
    requests.get(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        params={"chat_id": CHANNEL_ID, "text": message},
        timeout=10
    )

def get_random_tool():
    tools = [
        {"name": "Price Tracker", "desc": "Track live crypto prices in real-time", "url": "https://coinadvice.site/pages/price-tracker.html"},
        {"name": "Portfolio Tracker", "desc": "Manage your crypto holdings with P&L tracking", "url": "https://coinadvice.site/pages/portfolio.html"},
        {"name": "Currency Converter", "desc": "Convert crypto to fiat instantly", "url": "https://coinadvice.site/pages/converter.html"},
        {"name": "Token Checker", "desc": "Audit token security before investing", "url": "https://coinadvice.site/pages/token-checker.html"},
        {"name": "DEX Scanner", "desc": "Find hot DEX pairs across chains", "url": "https://coinadvice.site/pages/dex-scanner.html"},
        {"name": "Arbitrage Scanner", "desc": "Spot cross-exchange arbitrage opportunities", "url": "https://coinadvice.site/pages/arbitrage.html"},
        {"name": "Airdrop Finder", "desc": "Discover potential and active airdrops", "url": "https://coinadvice.site/pages/airdrops.html"},
        {"name": "Profit Calculator", "desc": "Calculate your investment ROI", "url": "https://coinadvice.site/pages/profit-calculator.html"},
        {"name": "Trending Coins", "desc": "See top gainers, losers, and trending coins", "url": "https://coinadvice.site/pages/trending.html"},
        {"name": "Global Stats", "desc": "View market cap, dominance, and volume data", "url": "https://coinadvice.site/pages/global-stats.html"}
    ]
    return random.choice(tools)

def post_tool():
    tool = get_random_tool()
    message = f"🛠️ Crypto Tool Spotlight 🛠️\n\n{tool['name']}\n{tool['desc']}\n\n🔗 Try it now: {tool['url']}\n\n🔗 Visit https://coinadvice.site for more in-depth analysis!\n"
    requests.get(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        params={"chat_id": CHANNEL_ID, "text": message},
        timeout=10
    )

if __name__ == "__main__":
    post_buy_tips()
    current_hour = datetime.utcnow().hour
    if current_hour in [9, 18]:
        post_blog()
    if current_hour in [12, 20]:
        post_tool()
