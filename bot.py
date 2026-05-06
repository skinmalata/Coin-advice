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

def post_buy_tips():
    coins = get_trending_coins()
    if not coins:
        return
    message = "🔥 Hourly Buy Tips 🔥\n\n"
    for coin in coins:
        item = coin["item"]
        name = item["name"]
        symbol = item["symbol"].upper()
        try:
            coin_res = requests.get(f"https://api.coingecko.com/api/v3/coins/{item['id']}", timeout=10)
            coin_res.raise_for_status()
            price = coin_res.json()["market_data"]["current_price"]["usd"]
            message += f"✅ {name} ({symbol}) — ${price:.2f} — Trending up!\n"
        except:
            message += f"✅ {name} ({symbol}) — Price unavailable\n"
    message += "\n🔗 Visit https://coinadvice.site for more in-depth analysis!\n"
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
