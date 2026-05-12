import requests
import os
import glob
import random
import json
from datetime import datetime, timezone

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
WHALE_THRESHOLD_USD = 100000

def format_price(n):
    if n is None:
        return "N/A"
    if isinstance(n, str):
        return n
    if n < 0.000001:
        return f"${n:.12f}"
    if n < 0.001:
        return f"${n:.9f}"
    if n < 1:
        return f"${n:.6f}"
    if n < 1000:
        return f"${n:.4f}"
    return f"${n:,.2f}"

def format_large_number(n):
    if n is None:
        return "N/A"
    if isinstance(n, str):
        return n
    if abs(n) >= 1e12:
        return f"{n/1e12:.2f}T"
    if abs(n) >= 1e9:
        return f"{n/1e9:.2f}B"
    if abs(n) >= 1e6:
        return f"{n/1e6:.2f}M"
    if abs(n) >= 1e3:
        return f"{n/1e3:.2f}K"
    if n < 1:
        return f"{n:.4f}"
    return f"{n:.2f}"

def get_btc_price():
    try:
        r = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", timeout=10)
        return r.json().get("bitcoin", {}).get("usd", 65000)
    except:
        return 65000

def get_eth_price():
    try:
        r = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", timeout=10)
        return r.json().get("ethereum", {}).get("usd", 3500)
    except:
        return 3500

def fetch_btc_whales():
    try:
        r = requests.get("https://blockchain.info/unconfirmed-transactions?format=json", timeout=15)
        data = r.json()
        txs = data.get("txs", [])
        btc_price = get_btc_price()
        whales = []
        for tx in txs[:50]:
            total_out = sum(o.get("value", 0) for o in tx.get("out", []))
            usd = total_out * 1e-8 * btc_price
            if usd > WHALE_THRESHOLD_USD:
                whales.append({
                    "hash": tx.get("hash", ""),
                    "btc": total_out * 1e-8,
                    "usd": usd,
                    "inputs": len(tx.get("inputs", [])),
                    "outputs": len(tx.get("out", []))
                })
        return sorted(whales, key=lambda x: x["usd"], reverse=True)[:5]
    except Exception as e:
        print(f"BTC whale fetch error: {e}")
        return []

def fetch_eth_whales():
    try:
        r = requests.get(
            "https://api.blockchair.com/ethereum/transactions?limit=20&sort=asc&q=value(>50000000000000000000)",
            timeout=15,
            headers={"User-Agent": "CoinAdviceBot/1.0"}
        )
        data = r.json()
        items = data.get("data", {})
        if not items:
            return []
        eth_price = get_eth_price()
        whales = []
        for tx_hash, tx in list(items.items())[:50]:
            if isinstance(tx, dict) and tx.get("value", 0) > 0:
                val = tx["value"] / 1e18
                usd = val * eth_price
                if usd > WHALE_THRESHOLD_USD:
                    whales.append({
                        "hash": tx.get("hash", tx_hash),
                        "eth": val,
                        "usd": usd,
                        "from": tx.get("sender", ""),
                        "to": tx.get("recipient", "")
                    })
        return sorted(whales, key=lambda x: x["usd"], reverse=True)[:5]
    except Exception as e:
        print(f"ETH whale fetch error: {e}")
        return []

def fetch_liquidations():
    try:
        symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
        all_liqs = []
        for sym in symbols:
            try:
                r = requests.get(
                    f"https://api.bybit.com/v5/market/liquidation?symbol={sym}&limit=10",
                    timeout=10
                )
                data = r.json()
                if data.get("retCode") == 0:
                    items = data.get("result", {}).get("list", [])
                    for item in items:
                        liq_size = float(item.get("size", 0))
                        liq_price = float(item.get("price", 0))
                        liq_side = item.get("side", "Buy")
                        liq_symbol = item.get("symbol", sym)
                        usd_value = liq_size * liq_price
                        if usd_value > 10000:
                            all_liqs.append({
                                "symbol": liq_symbol,
                                "side": liq_side,
                                "size": liq_size,
                                "price": liq_price,
                                "usd": usd_value,
                                "time": item.get("time", ""),
                                "side_emoji": "🔴 SHORT" if liq_side == "Buy" else "🟢 LONG"
                            })
            except:
                pass
        return sorted(all_liqs, key=lambda x: x["usd"], reverse=True)[:10]
    except Exception as e:
        print(f"Liquidation fetch error: {e}")
        return []

def fetch_breakouts():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&sparkline=false",
            timeout=15
        )
        coins = r.json()
        breakouts = []
        for c in coins:
            vol = c.get("total_volume", 0) or 0
            change = c.get("price_change_percentage_24h", 0) or 0
            high_24 = c.get("high_24h")
            low_24 = c.get("low_24h")
            price = c.get("current_price", 0) or 0
            if vol < 5e7 or not high_24 or not low_24:
                continue
            near_high = price >= high_24 * 0.995
            near_low = price <= low_24 * 1.005
            if near_high and change > 3:
                breakouts.append({
                    "name": c.get("name", "?"),
                    "symbol": c.get("symbol", "?").upper(),
                    "price": price,
                    "change": change,
                    "volume": vol,
                    "type": "🚀 BREAKOUT",
                    "high_24": high_24,
                    "low_24": low_24
                })
            elif near_low and change < -3:
                breakouts.append({
                    "name": c.get("name", "?"),
                    "symbol": c.get("symbol", "?").upper(),
                    "price": price,
                    "change": change,
                    "volume": vol,
                    "type": "💥 BREAKDOWN",
                    "high_24": high_24,
                    "low_24": low_24
                })
        return sorted(breakouts, key=lambda x: abs(x["change"]), reverse=True)[:5]
    except Exception as e:
        print(f"Breakout fetch error: {e}")
        return []

def post_whale_alerts():
    btc = fetch_btc_whales()
    eth = fetch_eth_whales()
    if not btc and not eth:
        return

    msg = "🐋 WHALE TRANSACTION ALERTS 🐋\n"
    msg += "━━━━━━━━━━━━━━━━━━━━━━\n\n"

        if btc:
            msg += "₿ BTC Large Transactions:\n"
            for w in btc[:3]:
                msg += f"• {format_large_number(w['btc'])} BTC (${format_large_number(w['usd'])})\n"
                msg += f"  {w['inputs']}i → {w['outputs']}o | [View](https://blockchain.info/tx/{w['hash']})\n\n"

        if eth:
            msg += "Ξ ETH Large Transactions:\n"
            for w in eth[:3]:
                addr_from = f"{w['from'][:6]}...{w['from'][-4:]}" if w.get('from') else "N/A"
                addr_to = f"{w['to'][:6]}...{w['to'][-4:]}" if w.get('to') else "N/A"
                msg += f"• {format_large_number(w['eth'])} ETH (${format_large_number(w['usd'])})\n"
            msg += f"  {addr_from} → {addr_to} | [View](https://etherscan.io/tx/{w['hash']})\n\n"

    msg += "🔗 https://coinadvice.site/pages/whale-wallet.html\n"
    send_msg(msg)

def post_liquidation_alerts():
    liqs = fetch_liquidations()
    if not liqs:
        return

    msg = "⚡ LIQUIDATION ALERTS ⚡\n"
    msg += "━━━━━━━━━━━━━━━━━━━━\n\n"
    for l in liqs[:5]:
        sym = l["symbol"].replace("USDT", "")
        msg += f"{l['side_emoji']} {sym}\n"
        msg += f"  Size: {format_large_number(l['size'])} contracts\n"
        msg += f"  Price: {format_price(l['price'])}\n"
        msg += f"  Value: ${format_large_number(l['usd'])}\n\n"
    msg += "⚠️ Large liquidations detected — volatility expected\n"
    msg += "🔗 https://coinadvice.site\n"
    send_msg(msg)

def post_breakout_alerts():
    breakouts = fetch_breakouts()
    if not breakouts:
        return

    msg = "📊 BREAKOUT ALERTS 📊\n"
    msg += "━━━━━━━━━━━━━━━━━━\n\n"
    for b in breakouts:
        vol_label = "🔥" if b["volume"] > 1e9 else "📈"
        msg += f"{b['type']} {b['name']} ({b['symbol']})\n"
        msg += f"  Price: {format_price(b['price'])}"
        if b["change"] > 0:
            msg += f" | 📈 +{b['change']:.2f}%\n"
        else:
            msg += f" | 📉 {b['change']:.2f}%\n"
        msg += f"  {vol_label} Vol: ${format_large_number(b['volume'])}\n"
        msg += f"  Range: {format_price(b['low_24'])} — {format_price(b['high_24'])}\n\n"
    msg += "🔗 https://coinadvice.site/pages/price-tracker.html\n"
    send_msg(msg)

# ── Existing features (kept from original bot) ──

def get_trending_coins():
    try:
        res = requests.get("https://api.coingecko.com/api/v3/search/trending", timeout=10)
        res.raise_for_status()
        return res.json()["coins"][:3]
    except:
        return []

def get_coin_analysis(coin_id):
    try:
        coin_res = requests.get(f"https://api.coingecko.com/api/v3/coins/{coin_id}", timeout=10)
        coin_res.raise_for_status()
        coin_data = coin_res.json()
        md = coin_data.get("market_data", {})
        price = md.get("current_price", {}).get("usd")
        pc24 = md.get("price_change_percentage_24h")
        pc7 = md.get("price_change_percentage_7d")
        pc30 = md.get("price_change_percentage_30d")
        rank = coin_data.get("market_cap_rank")
        mcap = md.get("market_cap", {}).get("usd")
        vol = md.get("total_volume", {}).get("usd")
        ath = md.get("ath", {}).get("usd")
        high24 = md.get("high_24h", {}).get("usd")
        low24 = md.get("low_24h", {}).get("usd")
        circ = md.get("circulating_supply")
        total = md.get("total_supply")

        ath_dist = ((price / ath - 1) * 100) if (price and ath and ath > 0) else None
        liq_ratio = (vol / mcap * 100) if (vol and mcap and mcap > 0) else None

        rsi = max(10, min(90, 50 + (pc24 or 0) * 2.5))
        if (pc24 or 0) > 5 and rsi < 70:
            signal = "🟢 STRONG BUY"
        elif (pc24 or 0) > 2 and rsi < 65:
            signal = "🟢 BUY"
        elif (pc24 or 0) < -10:
            signal = "🔴 WATCH"
        elif (pc24 or 0) < 0 and (pc7 or 0) < 0:
            signal = "🟡 CAUTIOUS"
        else:
            signal = "🟢 BUY"

        entry_low = price * 0.99 if price else None
        entry_high = price * 1.01 if price else None
        stop = (low24 * 0.97) if low24 else (price * 0.95 if price else None)
        tp1 = price * 1.08 if price else None
        tp2 = price * 1.15 if price else None
        risk = (price - stop) if (price and stop) else None
        reward = (tp1 - price) if (price and tp1) else None
        rr = round(reward / risk, 1) if (risk and reward and risk > 0) else None

        if vol:
            vol_lvl = "Very High" if vol > 1e9 else "High" if vol > 5e8 else "Normal" if vol > 1e8 else "Low"
        else:
            vol_lvl = "Unknown"

        trend = "Strong Up" if pc30 and pc30 > 10 else "Uptrend" if pc30 and pc30 > 0 else "Strong Down" if pc30 and pc30 < -10 else "Downtrend" if pc30 and pc30 < 0 else "Sideways"

        if pc24 and pc24 > 8:
            insight = (f"Strong momentum! {coin_data.get('name')} surged {pc24:.1f}% in 24h. "
                       f"RSI at {rsi:.0f} suggests {'overbought — wait for pullback' if rsi > 70 else 'room for growth'}. "
                       f"Scale in with tight stop.")
        elif pc24 and pc24 > 4:
            insight = (f"Solid bullish momentum with {pc24:.1f}% daily gain. "
                       f"Volume ${(vol or 0)/1e9:.1f}B confirms interest. "
                       f"Watch breakout above ${(high24 or price * 1.02):.2f}.")
        else:
            insight = (f"Steady trend. Price holding above ${(low24 or price * 0.98):.2f}. "
                       f"Good accumulation zone.")

        return {
            "name": coin_data.get("name"),
            "symbol": coin_data.get("symbol", "").upper(),
            "price": price, "pc24": pc24, "pc7": pc7, "pc30": pc30,
            "rank": rank, "mcap": mcap, "vol": vol, "ath": ath,
            "ath_dist": ath_dist, "liq_ratio": liq_ratio,
            "signal": signal, "rsi": rsi, "trend": trend, "vol_lvl": vol_lvl,
            "entry_low": entry_low, "entry_high": entry_high,
            "stop": stop, "tp1": tp1, "tp2": tp2, "rr": rr,
            "high24": high24, "low24": low24,
            "insight": insight, "supply_pct": (circ / total * 100) if (circ and total and total > 0) else None
        }
    except:
        return None

def post_buy_tips():
    coins = get_trending_coins()
    if not coins:
        return
    msg = "🔥 PREMIUM BUY SIGNALS 🔥\n━━━━━━━━━━━━━━━━━━━━\n\n"
    for coin in coins:
        item = coin["item"]
        name, sym, cid = item["name"], item["symbol"].upper(), item["id"]
        a = get_coin_analysis(cid)
        if not a:
            msg += f"⚠️ {name} ({sym}) — unavailable\n\n"
            continue
        msg += f"📊 {name} ({sym})\n🎯 {a['signal']}\n\n"
        if a["price"]:
            msg += f"💰 {format_price(a['price'])}\n"
        if a["pc24"] is not None:
            msg += f"{'📈' if a['pc24'] > 0 else '📉'} 24h: {a['pc24']:+.2f}%\n"
        if a["pc7"] is not None:
            msg += f"{'📈' if a['pc7'] > 0 else '📉'} 7d: {a['pc7']:+.2f}%\n"
        msg += "\n"
        if a["entry_low"] and a["entry_high"]:
            msg += f"🎯 Entry: {format_price(a['entry_low'])} — {format_price(a['entry_high'])}\n"
        if a["stop"]:
            msg += f"🛑 Stop: {format_price(a['stop'])}\n"
        if a["tp1"]:
            msg += f"🎯 TP1: {format_price(a['tp1'])}\n"
        if a["tp2"]:
            msg += f"🎯 TP2: {format_price(a['tp2'])}\n"
        if a["rr"]:
            msg += f"{'✅' if a['rr'] >= 2 else '⚠️'} R/R: 1:{a['rr']}\n"
        msg += "\n"
        if a["rank"]:
            msg += f"🏆 Rank: #{a['rank']}\n"
        if a["mcap"]:
            msg += f"📊 MCap: ${format_large_number(a['mcap'])}\n"
        if a["vol"]:
            msg += f"📈 Vol: ${format_large_number(a['vol'])} ({a['vol_lvl']})\n"
        msg += f"📉 RSI: {a['rsi']:.0f}\n📊 Trend: {a['trend']}\n\n"
        if a["insight"]:
            msg += f"💡 {a['insight']}\n"
        if a["ath"] and a["ath_dist"] is not None:
            msg += f"\n🚀 ATH: {format_price(a['ath'])} ({abs(a['ath_dist']):.1f}% below)\n" if a["ath_dist"] < 0 else f"\n🚀 ATH: {format_price(a['ath'])} ({a['ath_dist']:+.1f}% above)\n"
        msg += "\n━━━━━━━━━━━━━━━━━━━━\n\n"
    msg += "⚠️ Not financial advice | DYOR\n🔗 https://coinadvice.site\n"
    send_msg(msg)

def get_random_blog():
    blog_files = glob.glob("blog/*.html")
    if not blog_files:
        return None
    bf = random.choice(blog_files)
    try:
        with open(bf, 'r', encoding='utf-8') as f:
            content = f.read()
            import re
            tm = re.search(r'<title>(.*?)</title>', content, re.I)
            title = tm.group(1) if tm else "Blog Post"
            em = re.search(r'<p>(.*?)</p>', content, re.I | re.DOTALL)
            excerpt = ""
            if em:
                excerpt = re.sub(r'<[^>]+>', '', em.group(1))
                excerpt = re.sub(r'\s+', ' ', excerpt).strip()[:200]
            fname = os.path.basename(bf)
            return {"title": title, "excerpt": excerpt, "url": f"https://coinadvice.site/blog/{fname}"}
    except:
        return None

def post_blog():
    b = get_random_blog()
    if not b:
        return
    msg = f"📚 {b['title']}\n\n{b['excerpt']}\n\n🔗 {b['url']}\n"
    send_msg(msg)

def get_random_tool():
    tools = [
        ("Price Tracker", "Track live crypto prices", "https://coinadvice.site/pages/price-tracker.html"),
        ("Portfolio Tracker", "Manage holdings with P&L", "https://coinadvice.site/pages/portfolio.html"),
        ("Converter", "Convert crypto to fiat", "https://coinadvice.site/pages/converter.html"),
        ("Token Checker", "Audit token security", "https://coinadvice.site/pages/token-checker.html"),
        ("DEX Scanner", "Hot DEX pairs across chains", "https://coinadvice.site/pages/dex-scanner.html"),
        ("Arbitrage Scanner", "Cross-exchange arb", "https://coinadvice.site/pages/arbitrage.html"),
        ("Airdrop Finder", "Discover airdrops", "https://coinadvice.site/pages/airdrops.html"),
        ("Profit Calculator", "Calculate ROI", "https://coinadvice.site/pages/profit-calculator.html"),
        ("Trending Coins", "Top gainers & losers", "https://coinadvice.site/pages/trending.html"),
        ("Global Stats", "Market cap & dominance", "https://coinadvice.site/pages/global-stats.html"),
        ("Whale Tracker", "Track large transactions", "https://coinadvice.site/pages/whale-wallet.html"),
        ("Signal Scoreboard", "Track signal performance", "https://coinadvice.site/pages/signal-scoreboard.html"),
        ("Pump Scanner", "Detect early pumps & breakouts", "https://coinadvice.site/pages/pump-scanner.html"),
    ]
    t = random.choice(tools)
    return f"🛠️ Tool Spotlight 🛠️\n\n{t[0]}\n{t[1]}\n\n🔗 {t[2]}\n\n🔗 https://coinadvice.site\n"

def post_tool():
    send_msg(get_random_tool())

def send_msg(text):
    if not BOT_TOKEN or not CHANNEL_ID:
        print("Missing BOT_TOKEN or CHANNEL_ID")
        return
    try:
        r = requests.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            params={
                "chat_id": CHANNEL_ID,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True
            },
            timeout=15
        )
        if not r.ok:
            print(f"Telegram send failed: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"Telegram send error: {e}")

if __name__ == "__main__":
    print(f"Running bot at {datetime.now(timezone.utc).isoformat()}")

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
