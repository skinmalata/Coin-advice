import requests
import os
import re
from datetime import datetime, timezone
from bot import (
    fetch_btc_whales, fetch_eth_whales, fetch_liquidations, fetch_breakouts,
    get_trending_coins, get_coin_analysis, format_price, format_large_number,
    get_random_blog, get_random_tool
)

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID")
WHATSAPP_TO = os.getenv("WHATSAPP_TO")

def strip_html(s):
    s = s.replace('<b>', '*').replace('</b>', '*')
    s = s.replace('<i>', '_').replace('</i>', '_')
    s = s.replace('<code>', '`').replace('</code>', '`')
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return s.strip()

def truncate(text, max_len=4000):
    if len(text) <= max_len:
        return [text]
    parts = []
    while len(text) > max_len:
        split_at = text.rfind('\n\n', 0, max_len)
        if split_at == -1:
            split_at = text.rfind('\n', 0, max_len)
        if split_at == -1:
            split_at = max_len
        parts.append(text[:split_at].strip())
        text = text[split_at:].strip()
    if text:
        parts.append(text)
    return parts

def send_whatsapp(text):
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID or not WHATSAPP_TO:
        print("Missing WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, or WHATSAPP_TO")
        return
    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    for part in truncate(text):
        payload = {
            "messaging_product": "whatsapp",
            "to": WHATSAPP_TO,
            "type": "text",
            "text": { "body": part }
        }
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=15)
            if not r.ok:
                print(f"WhatsApp send failed: {r.status_code} {r.text[:300]}")
        except Exception as e:
            print(f"WhatsApp send error: {e}")

def post_whale_alerts():
    btc = fetch_btc_whales()
    eth = fetch_eth_whales()
    if not btc and not eth:
        return
    lines = ["🐋 *WHALE TRANSACTION ALERTS*", "───────────────────────\n"]
    if btc:
        lines.append("₿ *BTC Large Transactions:*")
        for w in btc[:3]:
            lines.append(f"• {format_large_number(w['btc'])} BTC (${format_large_number(w['usd'])})")
            lines.append(f"  {w['inputs']}i → {w['outputs']}o\n")
    if eth:
        lines.append("Ξ *ETH Large Transactions:*")
        for w in eth[:3]:
            lines.append(f"• {format_large_number(w['eth'])} ETH (${format_large_number(w['usd'])})")
            lines.append(f"  {w.get('from','?')[:6]}... → {w.get('to','?')[:6]}...\n")
    lines.append("🔗 https://coinadvice.site/pages/whale-wallet.html")
    send_whatsapp('\n'.join(lines))

def post_liquidation_alerts():
    liqs = fetch_liquidations()
    if not liqs:
        return
    lines = ["⚡ *LIQUIDATION ALERTS*", "─────────────────────\n"]
    for l in liqs[:5]:
        sym = l["symbol"].replace("USDT", "")
        lines.append(f"{l['side_emoji']} *{sym}*")
        lines.append(f"  Size: {format_large_number(l['size'])} contracts")
        lines.append(f"  Price: {format_price(l['price'])}")
        lines.append(f"  Value: ${format_large_number(l['usd'])}\n")
    lines.append("⚠️ Large liquidations detected — volatility expected")
    lines.append("🔗 https://coinadvice.site")
    send_whatsapp('\n'.join(lines))

def post_breakout_alerts():
    breakouts = fetch_breakouts()
    if not breakouts:
        return
    lines = ["📊 *BREAKOUT ALERTS*", "───────────────────\n"]
    for b in breakouts:
        vol_label = "🔥" if b["volume"] > 1e9 else "📈"
        change_str = f"📈 +{b['change']:.2f}%" if b["change"] > 0 else f"📉 {b['change']:.2f}%"
        lines.append(f"{b['type']} *{b['name']}* ({b['symbol']})")
        lines.append(f"  Price: {format_price(b['price'])} | {change_str}")
        lines.append(f"  {vol_label} Vol: ${format_large_number(b['volume'])}")
        lines.append(f"  Range: {format_price(b['low_24'])} — {format_price(b['high_24'])}\n")
    lines.append("🔗 https://coinadvice.site/pages/price-tracker.html")
    send_whatsapp('\n'.join(lines))

def post_buy_tips():
    coins = get_trending_coins()
    if not coins:
        return
    lines = ["🔥 *PREMIUM BUY SIGNALS*", "━━━━━━━━━━━━━━━━━━━━\n"]
    for coin in coins:
        item = coin["item"]
        name, sym, cid = item["name"], item["symbol"].upper(), item["id"]
        a = get_coin_analysis(cid)
        if not a:
            lines.append(f"⚠️ {name} ({sym}) — unavailable\n")
            continue
        lines.append(f"📊 *{name} ({sym})*")
        lines.append(f"🎯 {a['signal']}\n")
        if a["price"]:
            lines.append(f"💰 {format_price(a['price'])}")
        if a["pc24"] is not None:
            lines.append(f"{'📈' if a['pc24'] > 0 else '📉'} 24h: {a['pc24']:+.2f}%")
        if a["pc7"] is not None:
            lines.append(f"{'📈' if a['pc7'] > 0 else '📉'} 7d: {a['pc7']:+.2f}%")
        lines.append("")
        if a["entry_low"] and a["entry_high"]:
            lines.append(f"🎯 Entry: {format_price(a['entry_low'])} — {format_price(a['entry_high'])}")
        if a["stop"]:
            lines.append(f"🛑 Stop: {format_price(a['stop'])}")
        if a["tp1"]:
            lines.append(f"🎯 TP1: {format_price(a['tp1'])}")
        if a["tp2"]:
            lines.append(f"🎯 TP2: {format_price(a['tp2'])}")
        if a["rr"]:
            lines.append(f"{'✅' if a['rr'] >= 2 else '⚠️'} R/R: 1:{a['rr']}")
        lines.append("")
        if a["rank"]:
            lines.append(f"🏆 Rank: #{a['rank']}")
        if a["mcap"]:
            lines.append(f"📊 MCap: ${format_large_number(a['mcap'])}")
        if a["vol"]:
            lines.append(f"📈 Vol: ${format_large_number(a['vol'])} ({a['vol_lvl']})")
        if a["insight"]:
            lines.append(f"\n💡 {a['insight']}")
        lines.append("\n━━━━━━━━━━━━━━━━━━━━\n")
    lines.append("⚠️ Not financial advice | DYOR")
    lines.append("🔗 https://coinadvice.site")
    send_whatsapp('\n'.join(lines))

def post_blog():
    b = get_random_blog()
    if not b:
        return
    msg = f"📚 *{b['title']}*\n\n{b['excerpt']}\n\n🔗 {b['url']}"
    send_whatsapp(msg)

def post_tool():
    send_whatsapp(strip_html(get_random_tool()))

if __name__ == "__main__":
    print(f"Running WhatsApp bot at {datetime.now(timezone.utc).isoformat()}")

    print("Posting whale alerts...")
    post_whale_alerts()

    print("Posting liquidation alerts...")
    post_liquidation_alerts()

    print("Posting breakout alerts...")
    post_breakout_alerts()

    print("Posting buy tips...")
    post_buy_tips()

    current_hour = datetime.now(timezone.utc).hour
    if current_hour in [9, 18]:
        print("Posting blog...")
        post_blog()
    if current_hour in [12, 20]:
        print("Posting tool...")
        post_tool()

    print("Done")
