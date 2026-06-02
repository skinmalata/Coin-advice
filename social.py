import os
import re
import requests
from datetime import datetime, timezone

FACEBOOK_PAGE_ID = os.getenv("FACEBOOK_PAGE_ID")
FACEBOOK_ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
THREADS_USER_ID = os.getenv("THREADS_USER_ID")
THREADS_ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE")
BLUESKY_APP_PASSWORD = os.getenv("BLUESKY_APP_PASSWORD")

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


def broadcast(message, msg_type="alert", telegram_send=None):
    print(f"Broadcasting {msg_type}...")
    if telegram_send:
        telegram_send(message)
    post_to_facebook(message)
    post_to_threads(message)
    post_to_discord(message)
    post_to_bluesky(message)
