#!/usr/bin/env python3
"""
Quick test script to explore Polymarket API responses.
Tests both CLOB API and Gamma API.
"""

import json
import urllib.request
import urllib.error

CLOB_BASE = "https://clob.polymarket.com"
GAMMA_BASE = "https://gamma-api.polymarket.com"


def fetch(url: str):
    print(f"\nGET {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "darwin-capital-test/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            print(f"  Status: {resp.status}")
            return data
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error: {e.code} {e.reason}")
        print(f"  Body: {e.read().decode()[:500]}")
    except Exception as e:
        print(f"  Error: {e}")
    return None


def print_sample(data, label: str, n: int = 2):
    """Print a sample of items from a list or the data itself."""
    print(f"\n--- {label} ---")
    if isinstance(data, list):
        print(f"  Total items: {len(data)}")
        for i, item in enumerate(data[:n]):
            print(f"\n  [{i}] {json.dumps(item, indent=4)[:800]}")
    elif isinstance(data, dict):
        print(json.dumps(data, indent=2)[:1200])
    else:
        print(data)


# ─── CLOB API ───────────────────────────────────────────────────────────────

print("=" * 60)
print("POLYMARKET CLOB API")
print("=" * 60)

# List active markets (first page)
clob_markets = fetch(f"{CLOB_BASE}/markets?limit=5")
if clob_markets:
    items = clob_markets.get("data", clob_markets) if isinstance(clob_markets, dict) else clob_markets
    print_sample(items if isinstance(items, list) else [items], "CLOB /markets (first 2)")

    # Pull a single market if we got one
    if isinstance(items, list) and items:
        cid = items[0].get("condition_id") or items[0].get("id")
        if cid:
            single = fetch(f"{CLOB_BASE}/markets/{cid}")
            print_sample(single, f"CLOB /markets/{cid}")

# ─── Gamma API ───────────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print("POLYMARKET GAMMA API")
print("=" * 60)

gamma_markets = fetch(f"{GAMMA_BASE}/markets?limit=5&active=true")
if gamma_markets:
    items = gamma_markets.get("data", gamma_markets) if isinstance(gamma_markets, dict) else gamma_markets
    print_sample(items if isinstance(items, list) else [items], "Gamma /markets (first 2)")

gamma_events = fetch(f"{GAMMA_BASE}/events?limit=5&active=true")
if gamma_events:
    items = gamma_events.get("data", gamma_events) if isinstance(gamma_events, dict) else gamma_events
    print_sample(items if isinstance(items, list) else [items], "Gamma /events (first 2)")

print("\n" + "=" * 60)
print("Done.")
