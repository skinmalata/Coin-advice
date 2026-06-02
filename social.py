import os
import re
import io
import requests
from datetime import datetime, timezone

try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

FACEBOOK_PAGE_ID = os.getenv("FACEBOOK_PAGE_ID")
FACEBOOK_ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
THREADS_USER_ID = os.getenv("THREADS_USER_ID")
THREADS_ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE")
BLUESKY_APP_PASSWORD = os.getenv("BLUESKY_APP_PASSWORD")
INSTAGRAM_ID = os.getenv("INSTAGRAM_ID")
IMGUR_CLIENT_ID = os.getenv("IMGUR_CLIENT_ID")


GRAPH_API_VERSION = "v22.0"
THREADS_API_VERSION = "v22.0"


def strip_markdown(text):
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)
    text = re.sub(r'_(.*?)_', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 \2', text)
    return text


def post_to_facebook(message):
    if not FACEBOOK_PAGE_ID or not FACEBOOK_ACCESS_TOKEN:
        print("Missing FACEBOOK_PAGE_ID or FACEBOOK_ACCESS_TOKEN")
        return False

    clean = strip_markdown(message)
    clean = re.sub(r'🔗 https?://\S+', '', clean)
    clean = re.sub(r'https?://\S+', '', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean).strip()
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{FACEBOOK_PAGE_ID}/feed"

    try:
        r = requests.post(url, data={
            "message": clean,
            "access_token": FACEBOOK_ACCESS_TOKEN
        }, timeout=15)

        if r.ok:
            post_id = r.json().get("id", "?")
            print(f"Posted to Facebook: {post_id}")
            return True
        else:
            print(f"Facebook post failed: {r.status_code} {r.text[:300]}")
            return False
    except Exception as e:
        print(f"Facebook post error: {e}")
        return False


def post_to_threads(message):
    if not THREADS_USER_ID or not THREADS_ACCESS_TOKEN:
        print("Missing THREADS_USER_ID or THREADS_ACCESS_TOKEN")
        return False

    clean = strip_markdown(message)

    if len(clean) > 500:
        clean = clean[:497] + "..."

    create_url = f"https://graph.threads.net/{THREADS_API_VERSION}/{THREADS_USER_ID}/threads"
    try:
        r = requests.post(create_url, data={
            "media_type": "TEXT",
            "text": clean,
            "access_token": THREADS_ACCESS_TOKEN
        }, timeout=15)

        if not r.ok:
            print(f"Threads container creation failed: {r.status_code} {r.text[:300]}")
            return False

        media_id = r.json().get("id")

        publish_url = f"https://graph.threads.net/{THREADS_API_VERSION}/{THREADS_USER_ID}/threads_publish"
        r2 = requests.post(publish_url, data={
            "media_id": media_id,
            "access_token": THREADS_ACCESS_TOKEN
        }, timeout=15)

        if r2.ok:
            post_id = r2.json().get("id", "?")
            print(f"Posted to Threads: {post_id}")
            return True
        else:
            print(f"Threads publish failed: {r2.status_code} {r2.text[:300]}")
            return False
    except Exception as e:
        print(f"Threads post error: {e}")
        return False


def post_to_discord(message):
    if not DISCORD_WEBHOOK_URL:
        print("Missing DISCORD_WEBHOOK_URL")
        return False

    clean = strip_markdown(message)
    if len(clean) > 1900:
        clean = clean[:1900] + "..."

    try:
        r = requests.post(DISCORD_WEBHOOK_URL, json={
            "content": clean
        }, timeout=15)

        if r.ok:
            print("Posted to Discord")
            return True
        else:
            print(f"Discord post failed: {r.status_code} {r.text[:200]}")
            return False
    except Exception as e:
        print(f"Discord post error: {e}")
        return False


def _bluesky_session():
    r = requests.post(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        json={"identifier": BLUESKY_HANDLE, "password": BLUESKY_APP_PASSWORD},
        timeout=15
    )
    if not r.ok:
        print(f"Bluesky login failed: {r.status_code} {r.text[:200]}")
        return None
    return r.json()


def post_to_bluesky(message):
    if not BLUESKY_HANDLE or not BLUESKY_APP_PASSWORD:
        print("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD")
        return False

    session = _bluesky_session()
    if not session:
        return False

    clean = strip_markdown(message)
    if len(clean) > 300:
        clean = clean[:297] + "..."

    try:
        r = requests.post(
            "https://bsky.social/xrpc/com.atproto.repo.createRecord",
            headers={"Authorization": f"Bearer {session['accessJwt']}"},
            json={
                "repo": session["did"],
                "collection": "app.bsky.feed.post",
                "record": {
                    "text": clean,
                    "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                }
            },
            timeout=15
        )

        if r.ok:
            uri = r.json().get("uri", "?")
            print(f"Posted to Bluesky: {uri}")
            return True
        else:
            print(f"Bluesky post failed: {r.status_code} {r.text[:300]}")
            return False
    except Exception as e:
        print(f"Bluesky post error: {e}")
        return False


def _make_alert_image(message):
    if not HAS_PILLOW:
        print("Cannot generate image: Pillow not installed")
        return None

    type_labels = {
        "whale": "🐋 WHALE ALERT", "liquidation": "⚡ LIQUIDATION",
        "breakout": "📊 BREAKOUT", "buy_signal": "🔥 BUY SIGNAL",
        "blog": "📚 BLOG", "tool": "🛠️ TOOL"
    }

    lines = strip_markdown(message).strip().split("\n")
    first_line = next((l for l in lines if l.strip()), "")
    label = type_labels.get("alert", "📢 ALERT")
    for key, val in type_labels.items():
        if key in message.lower():
            label = val
            break

    key_lines = [l for l in lines if l.strip() and not l.startswith("━") and not l.startswith("═")][:6]
    body = "\n".join(key_lines)
    if len(body) > 400:
        body = body[:397] + "..."

    W, H = 1080, 1080
    img = Image.new("RGB", (W, H), (13, 13, 36))
    draw = ImageDraw.Draw(img)

    try:
        font_big = ImageFont.truetype("arial.ttf", 48)
        font_mid = ImageFont.truetype("arial.ttf", 36)
        font_sml = ImageFont.truetype("arial.ttf", 28)
    except:
        font_big = ImageFont.load_default()
        font_mid = ImageFont.load_default()
        font_sml = ImageFont.load_default()

    draw.text((60, 50), label, fill=(187, 134, 252), font=font_big)

    y = 140
    for line in body.split("\n"):
        while line and draw.textlength(line, font=font_sml) > 960:
            brk = -1
            for i in range(0, min(len(line), 55)):
                if line[i] == " ":
                    brk = i
            if brk == -1:
                brk = 55
            draw.text((60, y), line[:brk], fill=(255, 255, 255), font=font_sml)
            y += 40
            line = line[brk:].strip()
        if line:
            fill = (0, 230, 118) if "+" in line or "🟢" in line or "📈" in line else (255, 82, 82) if "-" in line and "%" in line or "🔴" in line else (255, 255, 255)
            draw.text((60, y), line, fill=fill, font=font_sml)
            y += 40

    draw.text((60, H - 80), "coinadvice.site", fill=(108, 99, 130), font=font_mid)

    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return buf


def _upload_to_imgur(image_buf):
    if not IMGUR_CLIENT_ID:
        print("Missing IMGUR_CLIENT_ID")
        return None

    try:
        r = requests.post(
            "https://api.imgur.com/3/image",
            headers={"Authorization": f"Client-ID {IMGUR_CLIENT_ID}"},
            files={"image": ("alert.png", image_buf, "image/png")},
            timeout=20
        )
        if r.ok:
            url = r.json()["data"]["link"]
            print(f"Uploaded image to Imgur: {url}")
            return url
        else:
            print(f"Imgur upload failed: {r.status_code} {r.text[:200]}")
            return None
    except Exception as e:
        print(f"Imgur upload error: {e}")
        return None


def post_to_instagram(message, msg_type="alert"):
    if not INSTAGRAM_ID or not FACEBOOK_ACCESS_TOKEN:
        print("Missing INSTAGRAM_ID or FACEBOOK_ACCESS_TOKEN")
        return False

    img_buf = _make_alert_image(message)
    if not img_buf:
        return False

    image_url = _upload_to_imgur(img_buf)
    if not image_url:
        return False

    clean = strip_markdown(message)
    caption = clean[:2200] if len(clean) > 2200 else clean

    try:
        r = requests.post(
            f"https://graph.facebook.com/{GRAPH_API_VERSION}/{INSTAGRAM_ID}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": FACEBOOK_ACCESS_TOKEN
            },
            timeout=15
        )
        if not r.ok:
            print(f"Instagram media create failed: {r.status_code} {r.text[:300]}")
            return False

        container_id = r.json().get("id")

        r2 = requests.post(
            f"https://graph.facebook.com/{GRAPH_API_VERSION}/{INSTAGRAM_ID}/media_publish",
            data={
                "creation_id": container_id,
                "access_token": FACEBOOK_ACCESS_TOKEN
            },
            timeout=15
        )
        if r2.ok:
            media_id = r2.json().get("id", "?")
            print(f"Posted to Instagram: {media_id}")
            return True
        else:
            print(f"Instagram publish failed: {r2.status_code} {r2.text[:300]}")
            return False
    except Exception as e:
        print(f"Instagram post error: {e}")
        return False


def broadcast(message, msg_type="alert", telegram_send=None):
    print(f"Broadcasting {msg_type}...")
    if telegram_send:
        telegram_send(message)
    post_to_facebook(message)
    post_to_threads(message)
    post_to_discord(message)
    post_to_bluesky(message)
    post_to_instagram(message, msg_type)
