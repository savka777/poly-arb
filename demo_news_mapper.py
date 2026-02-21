#!/usr/bin/env python3
"""
Polymarket -> News relevance demo pipeline.

What it does:
1) Fetch active Polymarket markets from Gamma API.
2) Pick top markets by a composite of volume, liquidity, and 24h price movement.
3) Build query variants per market (exact/entity/contrarian/macro).
4) Fetch news from configured providers (NewsAPI, GNews).
5) Score article relevance locally and map top articles per market.
6) Print colorful terminal output and optionally save JSON.

Environment variables (optional):
- NEWSAPI_KEY
- GNEWS_API_KEY
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

GAMMA_BASE = "https://gamma-api.polymarket.com"
DEFAULT_USER_AGENT = "darwin-news-mapper/0.1"
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "before",
    "by",
    "for",
    "from",
    "has",
    "how",
    "if",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
}
TRUSTED_SOURCES = {
    "reuters.com",
    "apnews.com",
    "bloomberg.com",
    "wsj.com",
    "ft.com",
    "nytimes.com",
    "bbc.com",
    "cnbc.com",
    "economist.com",
}


class Ansi:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"


@dataclass
class Market:
    id: str
    question: str
    slug: str
    category: str
    volume: float
    liquidity: float
    probability: float
    one_day_change: float
    end_date: str
    url: str


@dataclass
class NewsArticle:
    title: str
    description: str
    url: str
    source: str
    published_at: str
    provider: str


@dataclass
class RankedArticle:
    article: NewsArticle
    score: float
    confidence: float
    direction: str
    query: str


def c(text: str, color: str, enabled: bool) -> str:
    if not enabled:
        return text
    return f"{color}{text}{Ansi.RESET}"


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_iso(ts: str | None) -> dt.datetime | None:
    if not ts:
        return None
    fixed = ts.replace("Z", "+00:00")
    try:
        return dt.datetime.fromisoformat(fixed)
    except ValueError:
        return None


def http_get_json(url: str, timeout: int = 15, headers: dict[str, str] | None = None) -> Any:
    req_headers = {"User-Agent": DEFAULT_USER_AGENT}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def tokenize(text: str) -> list[str]:
    raw = re.findall(r"[A-Za-z0-9']+", text.lower())
    return [tok for tok in raw if tok not in STOPWORDS and len(tok) > 2]


def extract_entities(text: str) -> set[str]:
    candidates = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text)
    return {c.strip() for c in candidates if len(c.strip()) > 2}


def parse_probability(outcomes_raw: Any, prices_raw: Any) -> float:
    outcomes: list[str] = []
    prices: list[float] = []

    if isinstance(outcomes_raw, str):
        try:
            outcomes = json.loads(outcomes_raw)
        except json.JSONDecodeError:
            outcomes = []
    elif isinstance(outcomes_raw, list):
        outcomes = [str(x) for x in outcomes_raw]

    if isinstance(prices_raw, str):
        try:
            parsed = json.loads(prices_raw)
            prices = [float(x) for x in parsed]
        except (json.JSONDecodeError, ValueError, TypeError):
            prices = []
    elif isinstance(prices_raw, list):
        cleaned = []
        for x in prices_raw:
            try:
                cleaned.append(float(x))
            except (ValueError, TypeError):
                pass
        prices = cleaned

    if outcomes and prices and len(outcomes) == len(prices):
        for idx, outcome in enumerate(outcomes):
            if outcome.strip().lower() == "yes":
                return max(0.0, min(1.0, prices[idx]))
    if prices:
        return max(0.0, min(1.0, prices[0]))
    return 0.5


def fetch_polymarket_markets(limit: int = 200) -> list[Market]:
    # Gamma API supports list response for /markets.
    url = f"{GAMMA_BASE}/markets?active=true&closed=false&limit={limit}"
    data = http_get_json(url)
    items = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []

    markets: list[Market] = []
    for item in items:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question") or "").strip()
        slug = str(item.get("slug") or "")
        condition_id = str(item.get("conditionId") or item.get("condition_id") or item.get("id") or "")
        if not question or not condition_id:
            continue

        try:
            volume = float(item.get("volumeNum", item.get("volume", 0)) or 0)
        except (ValueError, TypeError):
            volume = 0.0
        try:
            liquidity = float(item.get("liquidityNum", item.get("liquidity", 0)) or 0)
        except (ValueError, TypeError):
            liquidity = 0.0
        try:
            one_day_change = float(item.get("oneDayPriceChange", 0) or 0)
        except (ValueError, TypeError):
            one_day_change = 0.0

        probability = parse_probability(item.get("outcomes"), item.get("outcomePrices"))

        markets.append(
            Market(
                id=condition_id,
                question=question,
                slug=slug,
                category=str(item.get("category") or "Unknown"),
                volume=volume,
                liquidity=liquidity,
                probability=probability,
                one_day_change=one_day_change,
                end_date=str(item.get("endDate") or item.get("end_date_iso") or ""),
                url=f"https://polymarket.com/event/{slug}" if slug else "https://polymarket.com",
            )
        )
    return markets


def load_markets_from_sample(sample_path: str) -> list[Market]:
    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Try common sample layouts used in this repo.
    candidates: Any = data
    if isinstance(data, dict):
        if isinstance(data.get("gamma_markets"), list):
            candidates = data["gamma_markets"]
        elif isinstance(data.get("gamma"), dict) and isinstance(data["gamma"].get("GET /markets"), list):
            candidates = data["gamma"]["GET /markets"]
        elif isinstance(data.get("clob_markets"), dict) and isinstance(data["clob_markets"].get("data"), list):
            candidates = data["clob_markets"]["data"]

    if not isinstance(candidates, list):
        return []

    markets: list[Market] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question") or item.get("title") or "").strip()
        slug = str(item.get("slug") or item.get("market_slug") or "")
        condition_id = str(item.get("conditionId") or item.get("condition_id") or item.get("id") or "")
        if not question or not condition_id:
            continue
        try:
            volume = float(item.get("volumeNum", item.get("volume", 0)) or 0)
        except (ValueError, TypeError):
            volume = 0.0
        try:
            liquidity = float(item.get("liquidityNum", item.get("liquidity", 0)) or 0)
        except (ValueError, TypeError):
            liquidity = 0.0
        try:
            one_day_change = float(item.get("oneDayPriceChange", 0) or 0)
        except (ValueError, TypeError):
            one_day_change = 0.0

        probability = parse_probability(
            item.get("outcomes") or [t.get("outcome") for t in item.get("tokens", []) if isinstance(t, dict)],
            item.get("outcomePrices") or [t.get("price") for t in item.get("tokens", []) if isinstance(t, dict)],
        )

        markets.append(
            Market(
                id=condition_id,
                question=question,
                slug=slug,
                category=str(item.get("category") or "Unknown"),
                volume=volume,
                liquidity=liquidity,
                probability=probability,
                one_day_change=one_day_change,
                end_date=str(item.get("endDate") or item.get("end_date_iso") or ""),
                url=f"https://polymarket.com/event/{slug}" if slug else "https://polymarket.com",
            )
        )
    return markets


def pick_top_markets(markets: list[Market], top_n: int) -> list[Market]:
    if not markets:
        return []

    max_volume = max((m.volume for m in markets), default=1.0) or 1.0
    max_liquidity = max((m.liquidity for m in markets), default=1.0) or 1.0
    max_move = max((abs(m.one_day_change) for m in markets), default=1.0) or 1.0

    def score(m: Market) -> float:
        v = m.volume / max_volume
        l = m.liquidity / max_liquidity
        mv = abs(m.one_day_change) / max_move
        return 0.5 * v + 0.3 * l + 0.2 * mv

    return sorted(markets, key=score, reverse=True)[:top_n]


def build_queries(market: Market) -> list[str]:
    q = market.question.strip(" ?")
    entities = sorted(extract_entities(market.question))
    entity = " ".join(entities[:3]) if entities else q
    category_hint = market.category if market.category and market.category != "Unknown" else "current events"

    variants = [
        q,
        f"{entity} latest developments",
        f"{q} analysis implications",
        f"arguments against: {q}",
        f"{category_hint} breaking news {entity}",
    ]

    # Deduplicate while preserving order.
    seen: set[str] = set()
    deduped: list[str] = []
    for variant in variants:
        cleaned = re.sub(r"\s+", " ", variant).strip()
        if cleaned and cleaned.lower() not in seen:
            deduped.append(cleaned)
            seen.add(cleaned.lower())
    return deduped


def with_cache(path: str, ttl_minutes: int) -> dict[str, Any]:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            blob = json.load(f)
        ts = parse_iso(blob.get("created_at"))
        if not ts:
            return {}
        age_min = (now_utc() - ts).total_seconds() / 60
        if age_min > ttl_minutes:
            return {}
        payload = blob.get("payload")
        if isinstance(payload, dict):
            return payload
    except Exception:
        return {}
    return {}


def write_cache(path: str, payload: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    blob = {"created_at": now_utc().isoformat(), "payload": payload}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(blob, f, indent=2)


def cache_key(provider: str, query: str, window_days: int) -> str:
    raw = f"{provider}|{query.lower()}|{window_days}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def fetch_newsapi(query: str, api_key: str, window_days: int, page_size: int = 10) -> list[NewsArticle]:
    since = (now_utc() - dt.timedelta(days=window_days)).strftime("%Y-%m-%d")
    params = urllib.parse.urlencode(
        {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "from": since,
            "pageSize": page_size,
            "apiKey": api_key,
        }
    )
    url = f"https://newsapi.org/v2/everything?{params}"
    data = http_get_json(url)
    articles = data.get("articles", []) if isinstance(data, dict) else []

    out: list[NewsArticle] = []
    for item in articles:
        if not isinstance(item, dict):
            continue
        source = item.get("source", {}) if isinstance(item.get("source"), dict) else {}
        out.append(
            NewsArticle(
                title=str(item.get("title") or ""),
                description=str(item.get("description") or ""),
                url=str(item.get("url") or ""),
                source=str(source.get("name") or "unknown"),
                published_at=str(item.get("publishedAt") or ""),
                provider="newsapi",
            )
        )
    return out


def fetch_gnews(query: str, api_key: str, window_days: int, max_results: int = 10) -> list[NewsArticle]:
    params = urllib.parse.urlencode(
        {
            "q": query,
            "lang": "en",
            "max": max_results,
            "sortby": "publishedAt",
            "apikey": api_key,
        }
    )
    url = f"https://gnews.io/api/v4/search?{params}"
    data = http_get_json(url)
    articles = data.get("articles", []) if isinstance(data, dict) else []

    cutoff = now_utc() - dt.timedelta(days=window_days)
    out: list[NewsArticle] = []
    for item in articles:
        if not isinstance(item, dict):
            continue
        published = str(item.get("publishedAt") or "")
        published_dt = parse_iso(published)
        if published_dt and published_dt < cutoff:
            continue
        source = item.get("source", {}) if isinstance(item.get("source"), dict) else {}
        out.append(
            NewsArticle(
                title=str(item.get("title") or ""),
                description=str(item.get("description") or ""),
                url=str(item.get("url") or ""),
                source=str(source.get("name") or "unknown"),
                published_at=published,
                provider="gnews",
            )
        )
    return out


def dedupe_articles(items: list[NewsArticle]) -> list[NewsArticle]:
    seen: set[str] = set()
    out: list[NewsArticle] = []
    for article in items:
        key = (article.url or article.title).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(article)
    return out


def source_domain(url: str) -> str:
    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
        return netloc[4:] if netloc.startswith("www.") else netloc
    except Exception:
        return ""


def classify_direction(text: str) -> str:
    low = text.lower()
    yes_terms = ["wins", "approved", "passes", "surges", "up", "positive", "supports"]
    no_terms = ["fails", "rejected", "falls", "down", "negative", "opposes", "denies"]
    yes_hits = sum(1 for t in yes_terms if t in low)
    no_hits = sum(1 for t in no_terms if t in low)
    if yes_hits > no_hits:
        return "supports_yes"
    if no_hits > yes_hits:
        return "supports_no"
    return "mixed"


def relevance_score(market: Market, query: str, article: NewsArticle) -> RankedArticle:
    market_tokens = set(tokenize(market.question))
    query_tokens = set(tokenize(query))
    article_tokens = set(tokenize(f"{article.title} {article.description}"))
    overlap = len((market_tokens | query_tokens) & article_tokens)
    base_overlap = overlap / max(4, len(market_tokens))

    m_entities = extract_entities(market.question)
    a_entities = extract_entities(f"{article.title} {article.description}")
    entity_overlap = len(m_entities & a_entities) / max(1, len(m_entities))

    published_dt = parse_iso(article.published_at)
    if published_dt:
        age_h = max(0.0, (now_utc() - published_dt).total_seconds() / 3600)
        recency = math.exp(-age_h / 72.0)
    else:
        recency = 0.35

    domain = source_domain(article.url)
    source_boost = 0.12 if domain in TRUSTED_SOURCES else 0.03

    score = 0.45 * base_overlap + 0.30 * entity_overlap + 0.20 * recency + source_boost
    score = max(0.0, min(1.0, score))
    confidence = max(0.0, min(1.0, 0.6 * score + 0.4 * recency))
    direction = classify_direction(f"{article.title} {article.description}")

    return RankedArticle(article=article, score=score, confidence=confidence, direction=direction, query=query)


def fmt_pct(value: float) -> str:
    return f"{value * 100:5.1f}%"


def trim(text: str, width: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= width:
        return text
    return text[: max(0, width - 1)] + "…"


def html_direction_badge(direction: str) -> str:
    klass = "mixed"
    if direction == "supports_yes":
        klass = "yes"
    elif direction == "supports_no":
        klass = "no"
    return f'<span class="badge {klass}">{html.escape(direction)}</span>'


def render_html_report(payload: dict[str, Any], out_path: str) -> None:
    created_at = str(payload.get("created_at", ""))
    top_markets = payload.get("top_markets", [])
    rows: list[str] = []

    for item in top_markets:
        market = item.get("market", {})
        question = html.escape(str(market.get("question", "Unknown market")))
        market_url = html.escape(str(market.get("url", "#")))
        category = html.escape(str(market.get("category", "Unknown")))
        probability = float(market.get("probability", 0) or 0)
        volume = float(market.get("volume", 0) or 0)
        liquidity = float(market.get("liquidity", 0) or 0)
        news_score = float(item.get("news_relevance_score", 0) or 0)
        news_direction = str(item.get("news_direction", "mixed"))
        rank = int(item.get("rank", 0) or 0)
        query_set = [html.escape(str(q)) for q in item.get("query_set", []) if q]

        articles_html: list[str] = []
        top_articles = item.get("top_articles", [])
        for art in top_articles:
            article = art.get("article", {})
            title = html.escape(str(article.get("title", "Untitled")))
            url = html.escape(str(article.get("url", "#")))
            source = html.escape(str(article.get("source", "unknown")))
            published = html.escape(str(article.get("published_at", "unknown")))
            score = float(art.get("score", 0) or 0)
            conf = float(art.get("confidence", 0) or 0)
            direction = str(art.get("direction", "mixed"))
            query = html.escape(str(art.get("query", "")))
            provider = html.escape(str(article.get("provider", "")))
            articles_html.append(
                "<tr>"
                f"<td>{score:.3f}</td>"
                f"<td>{conf:.3f}</td>"
                f"<td>{html_direction_badge(direction)}</td>"
                f"<td>{source}</td>"
                f"<td>{published}</td>"
                f"<td>{provider}</td>"
                f'<td><a href="{url}" target="_blank" rel="noopener">{title}</a><div class="query">query: {query}</div></td>'
                "</tr>"
            )

        if not articles_html:
            articles_html = ['<tr><td colspan="7" class="empty">No mapped articles</td></tr>']

        rows.append(
            "<section class='market-card'>"
            f"<h2>#{rank} {question}</h2>"
            "<div class='meta-grid'>"
            f"<div><span class='label'>Category</span><span>{category}</span></div>"
            f"<div><span class='label'>Market Prob</span><span>{probability * 100:.1f}%</span></div>"
            f"<div><span class='label'>Volume</span><span>${volume:,.0f}</span></div>"
            f"<div><span class='label'>Liquidity</span><span>${liquidity:,.0f}</span></div>"
            f"<div><span class='label'>News Score</span><span>{news_score:.3f}</span></div>"
            f"<div><span class='label'>Direction</span><span>{html_direction_badge(news_direction)}</span></div>"
            "</div>"
            f"<div class='market-link'><a href='{market_url}' target='_blank' rel='noopener'>Open market</a></div>"
            f"<div class='queries'><span class='label'>Query Set</span><div>{' | '.join(query_set) if query_set else 'none'}</div></div>"
            "<div class='table-wrap'>"
            "<table>"
            "<thead><tr><th>Score</th><th>Confidence</th><th>Direction</th><th>Source</th><th>Published</th><th>Provider</th><th>Article</th></tr></thead>"
            f"<tbody>{''.join(articles_html)}</tbody>"
            "</table>"
            "</div>"
            "</section>"
        )

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Polymarket News Mapping Report</title>
  <style>
    :root {{
      --bg: #f4f7fb;
      --panel: #ffffff;
      --ink: #1f2a37;
      --muted: #607085;
      --line: #dde4ee;
      --yes: #117a3f;
      --no: #b42318;
      --mixed: #8a6b00;
      --brand: #0e7490;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: radial-gradient(circle at 0% 0%, #d7eef6 0%, var(--bg) 45%), var(--bg);
      color: var(--ink);
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }}
    .container {{ max-width: 1200px; margin: 24px auto 60px; padding: 0 16px; }}
    .hero {{
      background: linear-gradient(140deg, #0e7490, #1d4ed8);
      color: #fff;
      border-radius: 16px;
      padding: 18px 20px;
      box-shadow: 0 10px 30px rgba(13, 38, 76, 0.2);
    }}
    .hero h1 {{ margin: 0 0 6px; font-size: 22px; }}
    .hero p {{ margin: 0; opacity: 0.92; }}
    .market-card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      margin-top: 14px;
      box-shadow: 0 8px 24px rgba(16, 24, 40, 0.06);
    }}
    .market-card h2 {{ margin: 0 0 10px; font-size: 18px; }}
    .meta-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }}
    .meta-grid > div {{
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      background: #f9fbff;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }}
    .label {{ color: var(--muted); font-size: 12px; }}
    .badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid transparent;
    }}
    .badge.yes {{ color: var(--yes); border-color: #86efac; background: #ecfdf3; }}
    .badge.no {{ color: var(--no); border-color: #fda29b; background: #fff1f0; }}
    .badge.mixed {{ color: var(--mixed); border-color: #fde68a; background: #fffbeb; }}
    .market-link {{ margin-bottom: 8px; }}
    .market-link a {{
      color: var(--brand);
      text-decoration: none;
      font-weight: 600;
    }}
    .queries {{
      border: 1px dashed var(--line);
      background: #fbfdff;
      border-radius: 10px;
      padding: 8px 10px;
      margin-bottom: 10px;
    }}
    .table-wrap {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }}
    table {{ width: 100%; border-collapse: collapse; min-width: 980px; }}
    th, td {{ text-align: left; border-bottom: 1px solid var(--line); padding: 8px; vertical-align: top; }}
    th {{ background: #f0f6ff; font-size: 12px; color: #344054; }}
    td {{ font-size: 13px; }}
    td a {{ color: #1d4ed8; text-decoration: none; }}
    .query {{ margin-top: 4px; color: var(--muted); font-size: 12px; }}
    .empty {{ color: var(--muted); font-style: italic; }}
    @media (max-width: 680px) {{
      .hero h1 {{ font-size: 18px; }}
      .market-card h2 {{ font-size: 16px; }}
    }}
  </style>
</head>
<body>
  <main class="container">
    <section class="hero">
      <h1>Polymarket → News Mapping Report</h1>
      <p>Generated at {html.escape(created_at)} | Markets analyzed: {len(top_markets)}</p>
    </section>
    {''.join(rows) if rows else "<p>No market rows in payload.</p>"}
  </main>
</body>
</html>
"""

    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)


def print_header(use_color: bool, top_n: int, providers: list[str]) -> None:
    print(c("=" * 96, Ansi.CYAN, use_color))
    print(c("DARWIN CAPITAL DEMO: POLYMARKET → NEWS MAPPING", Ansi.BOLD + Ansi.CYAN, use_color))
    print(
        c(
            f"UTC {now_utc().isoformat(timespec='seconds')} | top_n={top_n} | providers={', '.join(providers) if providers else 'none'}",
            Ansi.DIM,
            use_color,
        )
    )
    print(c("=" * 96, Ansi.CYAN, use_color))


def print_market_table(markets: list[Market], use_color: bool) -> None:
    print(c("\nTop Polymarket Candidates", Ansi.BOLD + Ansi.MAGENTA, use_color))
    print("-" * 96)
    print(f"{'#':<3} {'Category':<12} {'Prob':>7} {'1D Δ':>7} {'Volume':>11} {'Liquidity':>11}  Question")
    print("-" * 96)
    for idx, m in enumerate(markets, start=1):
        change = m.one_day_change
        change_col = Ansi.GREEN if change > 0 else (Ansi.RED if change < 0 else Ansi.YELLOW)
        ch_text = f"{change:+.3f}"
        print(
            f"{idx:<3} {trim(m.category, 12):<12} {fmt_pct(m.probability):>7} "
            f"{c(ch_text.rjust(7), change_col, use_color)} {m.volume:11,.0f} {m.liquidity:11,.0f}  {trim(m.question, 40)}"
        )
    print("-" * 96)


def print_mapping(
    market: Market,
    query_set: list[str],
    ranked: list[RankedArticle],
    use_color: bool,
    top_articles: int,
) -> None:
    print(c(f"\n[{market.category}] {market.question}", Ansi.BOLD + Ansi.BLUE, use_color))
    print(c(f"Market: {market.url}", Ansi.DIM, use_color))
    print(c(f"Query set ({len(query_set)}): " + " | ".join(query_set), Ansi.DIM, use_color))

    if not ranked:
        print(c("No news found for this market.", Ansi.YELLOW, use_color))
        return

    top = ranked[:top_articles]
    avg = sum(r.score for r in top) / len(top)
    direction_counts = {"supports_yes": 0, "supports_no": 0, "mixed": 0}
    for r in top:
        direction_counts[r.direction] = direction_counts.get(r.direction, 0) + 1
    if direction_counts["supports_yes"] > direction_counts["supports_no"]:
        market_direction = "supports_yes"
    elif direction_counts["supports_no"] > direction_counts["supports_yes"]:
        market_direction = "supports_no"
    else:
        market_direction = "mixed"

    color = Ansi.GREEN if market_direction == "supports_yes" else (Ansi.RED if market_direction == "supports_no" else Ansi.YELLOW)
    print(
        c(
            f"Aggregate score={avg:.3f} | news_direction={market_direction} | hits={len(ranked)}",
            color,
            use_color,
        )
    )

    print(f"{'Score':>7} {'Conf':>7} {'Dir':<12} {'Src':<18} {'When':<20}  Title")
    for item in top:
        pub = item.article.published_at or "unknown"
        dir_color = Ansi.GREEN if item.direction == "supports_yes" else (Ansi.RED if item.direction == "supports_no" else Ansi.YELLOW)
        print(
            f"{item.score:>7.3f} {item.confidence:>7.3f} {c(item.direction.ljust(12), dir_color, use_color)} "
            f"{trim(item.article.source, 18):<18} {trim(pub, 20):<20}  {trim(item.article.title, 48)}"
        )
        print(c(f"        {item.article.url}", Ansi.DIM, use_color))


def run(args: argparse.Namespace) -> int:
    use_color = not args.no_color and sys.stdout.isatty()
    providers: list[str] = []
    if os.getenv("NEWSAPI_KEY"):
        providers.append("newsapi")
    if os.getenv("GNEWS_API_KEY"):
        providers.append("gnews")

    print_header(use_color, args.top_markets, providers)

    markets: list[Market] = []
    if args.sample_file:
        try:
            markets = load_markets_from_sample(args.sample_file)
        except Exception as exc:
            print(c(f"Failed to load sample file {args.sample_file}: {exc}", Ansi.RED, use_color))
            return 1
    else:
        try:
            markets = fetch_polymarket_markets(limit=max(100, args.top_markets * 20))
        except Exception as exc:
            print(c(f"Live fetch failed: {exc}", Ansi.YELLOW, use_color))
            if os.path.exists(args.fallback_sample):
                print(c(f"Using offline fallback sample: {args.fallback_sample}", Ansi.DIM, use_color))
                markets = load_markets_from_sample(args.fallback_sample)
            else:
                print(c("No fallback sample available. Exiting.", Ansi.RED, use_color))
                return 1

    if not markets:
        print(c("No active markets returned by Gamma API.", Ansi.RED, use_color))
        return 1

    selected = pick_top_markets(markets, args.top_markets)
    print_market_table(selected, use_color)

    cache_root = os.path.join(".cache", "news_mapper")
    output_payload: dict[str, Any] = {
        "created_at": now_utc().isoformat(),
        "top_markets": [],
    }

    for idx, market in enumerate(selected, start=1):
        query_set = build_queries(market)
        all_articles: list[tuple[str, NewsArticle]] = []

        for query in query_set:
            if "newsapi" in providers:
                ck = cache_key("newsapi", query, args.window_days)
                cpath = os.path.join(cache_root, f"newsapi_{ck}.json")
                cached = with_cache(cpath, ttl_minutes=args.cache_ttl)
                items: list[NewsArticle] = []
                if cached:
                    raw = cached.get("articles", [])
                    for row in raw:
                        if isinstance(row, dict):
                            items.append(NewsArticle(**row))
                else:
                    try:
                        rows = fetch_newsapi(query, os.environ["NEWSAPI_KEY"], args.window_days, args.news_per_query)
                        write_cache(cpath, {"articles": [a.__dict__ for a in rows]})
                        items = rows
                    except Exception:
                        items = []
                all_articles.extend((query, a) for a in items)

            if "gnews" in providers:
                ck = cache_key("gnews", query, args.window_days)
                cpath = os.path.join(cache_root, f"gnews_{ck}.json")
                cached = with_cache(cpath, ttl_minutes=args.cache_ttl)
                items = []
                if cached:
                    raw = cached.get("articles", [])
                    for row in raw:
                        if isinstance(row, dict):
                            items.append(NewsArticle(**row))
                else:
                    try:
                        rows = fetch_gnews(query, os.environ["GNEWS_API_KEY"], args.window_days, args.news_per_query)
                        write_cache(cpath, {"articles": [a.__dict__ for a in rows]})
                        items = rows
                    except Exception:
                        items = []
                all_articles.extend((query, a) for a in items)

            # Keep API pacing gentle.
            time.sleep(args.sleep_s)

        deduped = dedupe_articles([a for _, a in all_articles])

        # Re-associate best query for each article.
        best_ranked: list[RankedArticle] = []
        for article in deduped:
            best: RankedArticle | None = None
            for q, candidate in all_articles:
                if (candidate.url or candidate.title) == (article.url or article.title):
                    ranked = relevance_score(market, q, article)
                    if not best or ranked.score > best.score:
                        best = ranked
            if best:
                best_ranked.append(best)

        best_ranked.sort(key=lambda x: (x.score, x.confidence), reverse=True)
        print_mapping(market, query_set, best_ranked, use_color, args.top_articles)

        top = best_ranked[: args.top_articles]
        agg_score = sum(r.score for r in top) / len(top) if top else 0.0
        dir_counts = {"supports_yes": 0, "supports_no": 0, "mixed": 0}
        for r in top:
            dir_counts[r.direction] = dir_counts.get(r.direction, 0) + 1
        if dir_counts["supports_yes"] > dir_counts["supports_no"]:
            market_dir = "supports_yes"
        elif dir_counts["supports_no"] > dir_counts["supports_yes"]:
            market_dir = "supports_no"
        else:
            market_dir = "mixed"

        output_payload["top_markets"].append(
            {
                "rank": idx,
                "market": market.__dict__,
                "query_set": query_set,
                "news_relevance_score": round(agg_score, 4),
                "news_direction": market_dir,
                "top_articles": [
                    {
                        "score": round(r.score, 4),
                        "confidence": round(r.confidence, 4),
                        "direction": r.direction,
                        "query": r.query,
                        "article": r.article.__dict__,
                    }
                    for r in top
                ],
            }
        )

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, indent=2)
        print(c(f"\nSaved JSON output: {args.output_json}", Ansi.CYAN, use_color))

    if args.output_html:
        render_html_report(output_payload, args.output_html)
        print(c(f"Saved HTML report: {args.output_html}", Ansi.CYAN, use_color))

    if not providers:
        print(c("\nNo news provider keys detected. Set NEWSAPI_KEY and/or GNEWS_API_KEY.", Ansi.YELLOW, use_color))
        print(c("Script still fetched and ranked top markets, but news mapping is empty.", Ansi.YELLOW, use_color))

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Polymarket news mapping demo")
    parser.add_argument("--top-markets", type=int, default=10, help="How many top Polymarket markets to analyze")
    parser.add_argument("--top-articles", type=int, default=5, help="Top mapped articles per market")
    parser.add_argument("--news-per-query", type=int, default=8, help="Max articles fetched per query/provider")
    parser.add_argument("--window-days", type=int, default=7, help="News recency window")
    parser.add_argument("--cache-ttl", type=int, default=30, help="Cache TTL in minutes")
    parser.add_argument("--sleep-s", type=float, default=0.1, help="Delay between provider calls")
    parser.add_argument("--output-json", type=str, default="", help="Optional path to save structured JSON output")
    parser.add_argument(
        "--output-html",
        type=str,
        default="docs/news_mapping_report.html",
        help="Path to write browser-viewable HTML report",
    )
    parser.add_argument("--sample-file", type=str, default="", help="Read Polymarket markets from local sample JSON")
    parser.add_argument(
        "--fallback-sample",
        type=str,
        default="docs/polymarket_response_samples.json",
        help="Fallback sample if live fetch fails",
    )
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI colored output")
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    raise SystemExit(run(args))
