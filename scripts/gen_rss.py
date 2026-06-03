import os, re, html
from datetime import datetime

BLOG_DIR = "blog"
SITE_URL = "https://coinadvice.site"
FEED_FILE = "rss.xml"

posts = []
for fname in sorted(os.listdir(BLOG_DIR), reverse=True):
    if not fname.endswith(".html"):
        continue
    path = os.path.join(BLOG_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    title_m = re.search(r'<title>(.*?)</title>', content, re.DOTALL)
    title = title_m.group(1).replace(" | Coin Advice", "").strip() if title_m else fname

    desc_m = re.search(r'<meta name="description" content="(.*?)">', content, re.DOTALL)
    desc = html.escape(desc_m.group(1)) if desc_m else ""

    date_m = re.search(r'"datePublished":\s*"(.*?)"', content)
    pub_date = date_m.group(1) if date_m else "2026-01-01"

    posts.append((fname, title, desc, pub_date))

items = []
for fname, title, desc, pub_date in posts:
    url = f"{SITE_URL}/blog/{fname}"
    rfc_date = datetime.fromisoformat(pub_date).strftime("%a, %d %b %Y %H:%M:%S +0000")
    items.append(f"""  <item>
    <title>{html.escape(title)}</title>
    <link>{url}</link>
    <guid>{url}</guid>
    <description>{desc}</description>
    <pubDate>{rfc_date}</pubDate>
  </item>""")

rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Coin Advice Blog</title>
    <link>{SITE_URL}/blog.html</link>
    <description>Crypto guides, exchange reviews, wallet tutorials, and trading strategies for 2026.</description>
    <language>en</language>
    <lastBuildDate>{datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")}</lastBuildDate>
    <atom:link href="{SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
{chr(10).join(items)}
  </channel>
</rss>"""

with open(FEED_FILE, "w", encoding="utf-8") as f:
    f.write(rss)

print(f"Generated {FEED_FILE} with {len(posts)} posts")
