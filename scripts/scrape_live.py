"""
HTML Scraper for famma-dhaw.com electricity status page.
Parses the live HTML to extract zone states.

Zero external dependencies - uses only Python standard library.

HTML structure (observed from target page):
  <div class="zone s-on" data-slug="el-wahat">
    <button class="zrow">
      <span class="zname">Cité El Wahat (El Agba)
        <span class="zsub">🔌 34 · 💡 52 · il y a 42s</span>
      </span>
      <span class="badge b-on">✅ Ça marche</span>
    </button>
  </div>

Usage:
    python scripts/scrape_live.py

Output:
    public/data/scraped_live.json
"""

import json
import os
import re
import ssl
import time
import urllib.request
import urllib.error
from html.parser import HTMLParser

# ── Output path: public/ so Vite serves as a static asset at /data/scraped_live.json
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'public', 'data', 'scraped_live.json'
)
TARGET_URL = 'https://famma-dhaw.com'
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/120.0.0.0 Safari/537.36'
)


# ── HTML Parser ────────────────────────────────────────────────────────────────
class ZoneParser(HTMLParser):
    """
    State-machine parser for the famma-dhaw.com zone listing.
    Extracts zone slug, name, on_count, off_count, and state from the raw HTML.
    """
    def __init__(self):
        super().__init__()
        self.zones = []

        # State tracking
        self._in_zone = False
        self._current = {}
        self._in_zname = False
        self._in_zsub = False
        self._capture_name = False
        self._zname_text = ''
        self._zsub_text = ''
        self._depth = 0          # nesting depth inside the current .zone div
        self._zone_tag_depth = 0 # depth at which the zone div started

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        classes = attrs_d.get('class', '').split()

        if tag == 'div' and 'zone' in classes:
            self._in_zone = True
            self._depth = 0
            self._zone_tag_depth = 0
            # Extract slug
            slug = attrs_d.get('data-slug', '').strip()
            # Extract state from class (s-on, s-off, s-mixed)
            state = 'no_data'
            if 's-on' in classes:
                state = 'on'
            elif 's-off' in classes:
                state = 'off'
            elif 's-mixed' in classes or 's-contested' in classes:
                state = 'contested'
            self._current = {'slug': slug, 'state': state,
                             'on_count': 0, 'off_count': 0,
                             'name_fr': '', 'gov': ''}
            self._zname_text = ''
            self._zsub_text = ''
            return

        if not self._in_zone:
            return

        self._depth += 1

        if tag == 'span' and 'zname' in classes:
            self._in_zname = True
            self._capture_name = True
            return

        if tag == 'span' and 'zsub' in classes:
            self._in_zsub = True
            self._in_zname = False  # stop capturing plain name text
            return

    def handle_data(self, data):
        if not self._in_zone:
            return

        text = data.strip()
        if not text:
            return

        if self._in_zname and not self._in_zsub and self._capture_name:
            self._zname_text += text

        if self._in_zsub:
            self._zsub_text += text

    def handle_endtag(self, tag):
        if not self._in_zone:
            return

        if tag == 'span' and self._in_zsub:
            self._in_zsub = False
            # Parse counts from zsub text like "🔌 34 · 💡 52 · il y a 42s"
            nums = re.findall(r'\d+', self._zsub_text)
            if len(nums) >= 2:
                self._current['off_count'] = int(nums[0])
                self._current['on_count'] = int(nums[1])
            return

        if tag == 'span' and self._in_zname and self._capture_name:
            self._in_zname = False
            self._capture_name = False
            self._current['name_fr'] = self._zname_text.strip()
            return

        if tag == 'div':
            if self._depth > 0:
                self._depth -= 1
            if self._depth == 0 and self._in_zone:
                # End of zone div — save if it has a slug
                if self._current.get('slug'):
                    # Derive governorate from name (simplified: use full name)
                    self._current['gov'] = self._current['name_fr']
                    self.zones.append(dict(self._current))
                self._in_zone = False
                self._current = {}


# ── Fetch raw HTML ─────────────────────────────────────────────────────────────
def fetch_html(url: str) -> str | None:
    print(f'📡 Fetching {url}')
    # famma-dhaw.com has an expired SSL cert — disable verification for this known host
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'fr-TN,fr;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            if resp.status == 200:
                charset = 'utf-8'
                content_type = resp.headers.get('Content-Type', '')
                m = re.search(r'charset=([\w-]+)', content_type)
                if m:
                    charset = m.group(1)
                html = resp.read().decode(charset, errors='replace')
                print(f'✅ Downloaded {len(html):,} bytes')
                return html
            else:
                print(f'⚠️  HTTP {resp.status}')
    except urllib.error.HTTPError as e:
        print(f'⚠️  HTTP Error {e.code}: {e.reason}')
    except Exception as e:
        print(f'⚠️  Error: {e}')
    return None


# ── Parse HTML ─────────────────────────────────────────────────────────────────
def parse_zones(html: str) -> list[dict]:
    parser = ZoneParser()
    parser.feed(html)
    zones = parser.zones
    print(f'🔍 Parsed {len(zones)} zones from HTML')
    return zones


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('=' * 60)
    print('⚡ TunisianH Live HTML Scraper')
    print(f'   Target: {TARGET_URL}')
    print('=' * 60)

    html = fetch_html(TARGET_URL)

    if html:
        zones = parse_zones(html)
    else:
        zones = []

    status = 'scraped' if zones else 'fallback'
    print(f'📊 {len(zones)} zones extracted (status: {status})')

    result = {
        'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source_url': TARGET_URL,
        'engine': 'Python html.parser (stdlib)',
        'status': status,
        'total_zones': len(zones),
        'zones': [
            {
                'slug': z['slug'],
                'name': z['name_fr'],
                'gov': z['gov'],
                'on_count': z['on_count'],
                'off_count': z['off_count'],
                'state': z['state'],
                'last_report': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            }
            for z in zones
        ],
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f'\n✅ Saved → {OUTPUT_PATH}')
    if zones:
        print('\nSample zones:')
        for z in zones[:5]:
            icon = '💡' if z['state'] == 'on' else '🔌' if z['state'] == 'off' else '⚡'
            print(f'  {icon} [{z["slug"]}] {z["name_fr"]} — ON:{z["on_count"]} OFF:{z["off_count"]}')


if __name__ == '__main__':
    main()
