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
    """Fetch and analyze coin data to generate premium insights."""
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
        
        # Calculate metrics
        ath_distance = ((price / ath - 1) * 100) if (price and ath and ath > 0) else None
        liquidity_ratio = (volume_24h / market_cap * 100) if (volume_24h and market_cap and market_cap > 0) else None
        supply_ratio = (circulating_supply / total_supply * 100) if (circulating_supply and total_supply and total_supply > 0) else None
        
        # Generate signal
        signal = "🟢 STRONG BUY"
        if price_change_24h and price_change_7d:
            if price_change_24h < -10:
                signal = "🔴 WATCH"
            elif price_change_24h < 0 and price_change_7d < 0:
                signal = "🟡 CAUTIOUS"
            elif price_change_24h > 10 and price_change_7d > 5:
                signal = "🟢 STRONG BUY"
            elif price_change_24h > 5:
                signal = "🟢 BUY"
        
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
            "signal": signal
        }
    except:
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
        
        # Build premium analysis
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
        
        # Market Data
        if analysis['market_cap_rank']:
            message += f"🏆 Rank: #{analysis['market_cap_rank']}\n"
        if analysis['market_cap']:
            mc_b = analysis['market_cap'] / 1e9
            message += f"📊 MCap: ${mc_b:.2f}B\n"
        if analysis['volume_24h']:
            vol_b = analysis['volume_24h'] / 1e9
            message += f"📈 Volume: ${vol_b:.2f}B\n"
        
        # Liquidity analysis
        if analysis['liquidity_ratio']:
            liq = analysis['liquidity_ratio']
            if liq > 10:
                liq_status = "🔥 Very High"
            elif liq > 5:
                liq_status = "✅ High"
            elif liq > 2:
                liq_status = "⚠️ Moderate"
            else:
                liq_status = "🔴 Low"
            message += f"💧 Liquidity: {liq_status} ({liq:.1f}%)\n"
        
        message += "\n"
        
        # ATH Analysis
        if analysis['ath'] and analysis['ath_distance']:
            distance = analysis['ath_distance']
            message += f"🚀 ATH: ${analysis['ath']:,.2f} ({analysis['ath_date']})\n"
            if distance < -50:
                message += f"📍 Current: {abs(distance):.1f}% BELOW ATH — Potential upside\n"
            elif distance < -20:
                message += f"📍 Current: {abs(distance):.1f}% BELOW ATH — Room to grow\n"
            else:
                message += f"📍 Current: {distance:+.1f}% from ATH\n"
        
        # Supply analysis
        if analysis['supply_ratio']:
            message += f"🪙 Supply: {analysis['supply_ratio']:.1f}% circulating\n"
        
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
            title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
            title = title_match.group(1) if title_match else "Blog Post"
            filename = os.path.basename(blog_file)
            url = f"https://coinadvice.site/blog/{filename}"
            return {"title": title, "url": url}
    except:
        return None

def post_blog():
    blog = get_random_blog()
    if not blog:
        return
    message = f"📚 Blog Post 📚\n\n{blog['title']}\n\n🔗 Read more: {blog['url']}\n\n🔗 Visit https://coinadvice.site for more in-depth analysis!\n"
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
