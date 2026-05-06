import requests
import os

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")

def get_trending_coins():
    try:
        res = requests.get("https://api.coingecko.com/api/v3/search/trending", timeout=10)
        res.raise_for_status()
        return res.json()["coins"][:3]
    except:
        return []

def post_to_channel():
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
    requests.get(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        params={"chat_id": CHANNEL_ID, "text": message},
        timeout=10
    )

if __name__ == "__main__":
    post_to_channel()
