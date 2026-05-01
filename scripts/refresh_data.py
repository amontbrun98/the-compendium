#!/usr/bin/env python3
"""
The Compendium — daily data refresh.

Pulls live prices and selected fundamentals from yfinance for every ticker in
data/core.json and data/watch.json. Pulls macro indicators from FRED if
FRED_API_KEY is set, otherwise falls back to ETF-based proxies via yfinance.

Writes:
  data/prices.json      — latest price + valuation snapshot per ticker
  data/macro.json       — macro regime + indicator snapshot for the Dalio overlay
  data/last_updated.json — manifest of all refreshes

Usage:
  python3 scripts/refresh_data.py [--prices-only] [--macro-only]

Run weekly (or daily) via cron or GitHub Action. The site reads these JSON
files at runtime — see assets/data-loader.js.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time
import datetime as dt
from pathlib import Path

import yfinance as yf
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

FRED_KEY = os.environ.get("FRED_API_KEY", "").strip()


# ---------------------------------------------------------------------------
# PRICES + VALUATION (yfinance)
# ---------------------------------------------------------------------------

def safe_get(info: dict, *keys, default=None):
    for k in keys:
        v = info.get(k)
        if v is not None:
            return v
    return default


def fetch_ticker(ticker: str) -> dict:
    """Pull the volatile fields we want refreshed daily for a single ticker."""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
    except Exception as exc:  # noqa: BLE001
        return {"t": ticker, "error": str(exc)[:200]}

    # Build a focused payload — ignore the 100+ junk fields yfinance returns
    payload = {
        "t": ticker,
        "price": safe_get(info, "currentPrice", "regularMarketPrice"),
        "marketCap": safe_get(info, "marketCap"),
        "ev": safe_get(info, "enterpriseValue"),
        "pe_trailing": safe_get(info, "trailingPE"),
        "pe_forward": safe_get(info, "forwardPE"),
        "ev_rev": safe_get(info, "enterpriseToRevenue"),
        "ev_ebitda": safe_get(info, "enterpriseToEbitda"),
        "peg": safe_get(info, "pegRatio", "trailingPegRatio"),
        "fcfY": (
            (info.get("freeCashflow") or 0) / info["marketCap"] * 100
            if info.get("freeCashflow") and info.get("marketCap") else None
        ),
        "gm": (info.get("grossMargins") or 0) * 100 if info.get("grossMargins") is not None else None,
        "om": (info.get("operatingMargins") or 0) * 100 if info.get("operatingMargins") is not None else None,
        "fwdG_eps": (info.get("earningsGrowth") or 0) * 100 if info.get("earningsGrowth") is not None else None,
        "fwdG_rev": (info.get("revenueGrowth") or 0) * 100 if info.get("revenueGrowth") is not None else None,
        "shortRatio": safe_get(info, "shortRatio"),
        "shortPercent": (info.get("shortPercentOfFloat") or 0) * 100 if info.get("shortPercentOfFloat") is not None else None,
        "dy": (info.get("dividendYield") or 0) * 100 if info.get("dividendYield") is not None else None,
        "beta": safe_get(info, "beta"),
        "52wHigh": safe_get(info, "fiftyTwoWeekHigh"),
        "52wLow": safe_get(info, "fiftyTwoWeekLow"),
        "asof": dt.datetime.utcnow().isoformat() + "Z",
    }
    return payload


def load_universe() -> list[str]:
    tickers = set()
    for fname in ("core.json", "watch.json"):
        path = DATA / fname
        if not path.exists():
            continue
        for c in json.loads(path.read_text()):
            if c.get("t"):
                tickers.add(c["t"])
    # Add macro-overlay benchmark tickers used by the All Weather + regime engines
    benchmarks = {
        "SPY", "QQQ", "DIA", "IWM",      # equities
        "TLT", "IEF", "SHY", "TIP",       # rates / inflation
        "GLD", "SLV", "DBC", "USO",       # commodities / hard assets
        "VNQ", "EFA", "EEM", "FXI",       # real estate / international
        "VIX", "^VIX",
        "DX-Y.NYB",                       # dollar index
        "BTC-USD",
    }
    tickers.update(benchmarks)
    return sorted(tickers)


def refresh_prices(throttle: float = 0.4) -> dict:
    universe = load_universe()
    out: list[dict] = []
    failed: list[str] = []
    for i, t in enumerate(universe, 1):
        row = fetch_ticker(t)
        if "error" in row:
            failed.append(t)
        out.append(row)
        # be polite to yahoo
        time.sleep(throttle)
        if i % 10 == 0:
            print(f"  fetched {i}/{len(universe)}", file=sys.stderr)

    payload = {
        "asof": dt.datetime.utcnow().isoformat() + "Z",
        "source": "yfinance",
        "count": len(out),
        "failed": failed,
        "rows": out,
    }
    (DATA / "prices.json").write_text(json.dumps(payload, indent=2, default=str))
    print(f"prices.json: {len(out)} rows, {len(failed)} failed")
    return payload


# ---------------------------------------------------------------------------
# MACRO (FRED + fallback ETF proxies)
# ---------------------------------------------------------------------------

# FRED series we care about for the four Dalio frameworks.
# Each entry: (key_we_use_in_json, FRED_series_id, human_label)
FRED_SERIES = [
    # Four-quadrant inputs
    ("real_gdp_yoy",          "A191RL1Q225SBEA", "Real GDP YoY (%)"),
    ("core_cpi_yoy",          "CORESTICKM159SFRBATL", "Sticky-Price Core CPI YoY (%)"),
    ("ism_manufacturing",     "MANEMP",          "Manufacturing employment (proxy for ISM)"),
    ("unemployment",          "UNRATE",          "Unemployment rate (%)"),
    # Big Cycle / Big Debt Crises inputs
    ("federal_debt_to_gdp",   "GFDEGDQ188S",     "Federal Debt to GDP (%)"),
    ("debt_service_ratio",    "TDSP",            "Household debt service / disposable income (%)"),
    ("fed_funds",             "DFF",             "Federal funds rate (%)"),
    ("ten_year",              "DGS10",           "10-year Treasury yield (%)"),
    ("real_ten_year",         "DFII10",          "10-year TIPS real yield (%)"),
    ("yield_curve_10_2",      "T10Y2Y",          "10y minus 2y Treasury spread (%)"),
    ("dxy",                   "DTWEXBGS",        "Trade-weighted dollar (broad)"),
    ("breakeven_5y",          "T5YIE",           "5-year breakeven inflation (%)"),
    ("m2_yoy",                "M2SL",            "M2 money stock"),
    # Risk-on/risk-off proxies from FRED
    ("hy_spread",             "BAMLH0A0HYM2",    "ICE BofA HY OAS (%)"),
]


def fred_series(series_id: str) -> dict | None:
    if not FRED_KEY:
        return None
    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 12,  # last ~year of observations for trend
    }
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        obs = r.json().get("observations", [])
        # most recent non-empty value
        latest = next(((o["date"], o["value"]) for o in obs if o["value"] not in (".", "")), (None, None))
        prev = next(
            ((o["date"], o["value"]) for o in obs[1:] if o["value"] not in (".", "")),
            (None, None),
        )
        return {
            "series_id": series_id,
            "latest_date": latest[0],
            "latest_value": float(latest[1]) if latest[1] else None,
            "prev_date": prev[0],
            "prev_value": float(prev[1]) if prev[1] else None,
            "trend": (
                "up" if (latest[1] and prev[1] and float(latest[1]) > float(prev[1]))
                else "down" if (latest[1] and prev[1] and float(latest[1]) < float(prev[1]))
                else "flat"
            ),
        }
    except Exception as exc:  # noqa: BLE001
        return {"series_id": series_id, "error": str(exc)[:200]}


def etf_proxies() -> dict:
    """Used when FRED key isn't set. Estimate macro state from market-implied prices."""
    proxies: dict = {}
    pairs = [
        # (our_key, ticker, comment)
        ("equities",        "SPY",  "S&P 500 ETF"),
        ("nasdaq",          "QQQ",  "Nasdaq 100 ETF"),
        ("longbonds",       "TLT",  "20+yr Treasury ETF"),
        ("midbonds",        "IEF",  "7-10yr Treasury ETF"),
        ("tips",            "TIP",  "TIPS ETF"),
        ("gold",            "GLD",  "Gold ETF"),
        ("commodities",     "DBC",  "Broad commodities ETF"),
        ("dollar",          "UUP",  "Dollar bullish ETF"),
        ("em",              "EEM",  "EM equities ETF"),
        ("intl_dev",        "EFA",  "Intl developed equities ETF"),
        ("vix",             "^VIX", "VIX index"),
    ]
    for key, ticker, label in pairs:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="3mo", interval="1d")
            if hist.empty:
                continue
            latest = float(hist["Close"].iloc[-1])
            month_ago = float(hist["Close"].iloc[-21]) if len(hist) >= 21 else float(hist["Close"].iloc[0])
            three_mo = float(hist["Close"].iloc[0])
            proxies[key] = {
                "ticker": ticker,
                "label": label,
                "latest": latest,
                "1mo_pct": (latest / month_ago - 1) * 100,
                "3mo_pct": (latest / three_mo - 1) * 100,
            }
        except Exception as exc:  # noqa: BLE001
            proxies[key] = {"ticker": ticker, "error": str(exc)[:200]}
    return proxies


def classify_regime(snap: dict) -> dict:
    """
    Map current data into Dalio's four economic regimes.

    Quadrant axes:
      - Growth:    rising or falling vs trend
      - Inflation: rising or falling vs trend

    Four regimes & textbook asset tilts:
      Q1 — Growth ↑ Inflation ↓   "Goldilocks"   → equities, credit
      Q2 — Growth ↑ Inflation ↑   "Reflation"    → commodities, EM, value, gold
      Q3 — Growth ↓ Inflation ↓   "Deflation"    → long bonds, defensive equities
      Q4 — Growth ↓ Inflation ↑   "Stagflation"  → gold, commodities, TIPS, cash
    """
    fred = snap.get("fred", {}) or {}
    proxies = snap.get("etf_proxies", {}) or {}

    # Growth signal
    growth_signal = None
    growth_evidence = []

    gdp = fred.get("real_gdp_yoy") or {}
    if gdp.get("latest_value") is not None and gdp.get("prev_value") is not None:
        growth_signal = "up" if gdp["latest_value"] > gdp["prev_value"] else "down"
        growth_evidence.append(f"Real GDP YoY {gdp['latest_value']:.2f}% (prev {gdp['prev_value']:.2f}%)")
    else:
        # fallback: equities 3-month trend + HY spread
        spy = proxies.get("equities", {})
        spy_3mo = spy.get("3mo_pct")
        if spy_3mo is not None:
            growth_signal = "up" if spy_3mo > 0 else "down"
            growth_evidence.append(f"SPY 3-mo {spy_3mo:+.1f}% (proxy)")

    # Inflation signal
    infl_signal = None
    infl_evidence = []

    cpi = fred.get("core_cpi_yoy") or {}
    if cpi.get("latest_value") is not None and cpi.get("prev_value") is not None:
        infl_signal = "up" if cpi["latest_value"] > cpi["prev_value"] else "down"
        infl_evidence.append(f"Core CPI YoY {cpi['latest_value']:.2f}% (prev {cpi['prev_value']:.2f}%)")
    else:
        # fallback: TIPS vs Treasuries spread (TIP / IEF) proxy
        tip = proxies.get("tips", {}).get("3mo_pct")
        ief = proxies.get("midbonds", {}).get("3mo_pct")
        if tip is not None and ief is not None:
            spread = tip - ief
            infl_signal = "up" if spread > 0 else "down"
            infl_evidence.append(f"TIP - IEF 3-mo spread {spread:+.2f}pp (proxy)")

    quadrant_map = {
        ("up", "down"):   ("Q1", "Goldilocks",   "Growth rising, inflation falling. Risk-on regime — equities and credit lead."),
        ("up", "up"):     ("Q2", "Reflation",    "Growth and inflation both rising. Commodities, value, EM, real assets."),
        ("down", "down"): ("Q3", "Deflation",    "Growth and inflation both falling. Long bonds and defensive equities."),
        ("down", "up"):   ("Q4", "Stagflation",  "Growth falling while inflation rises. Gold, commodities, TIPS, cash. Hardest regime."),
    }
    quad = quadrant_map.get((growth_signal, infl_signal))
    return {
        "growth": growth_signal,
        "inflation": infl_signal,
        "quadrant": quad[0] if quad else None,
        "regime_name": quad[1] if quad else "Unclassified",
        "regime_explainer": quad[2] if quad else "Insufficient data to classify",
        "growth_evidence": growth_evidence,
        "inflation_evidence": infl_evidence,
    }


def big_debt_crisis_tripwires(snap: dict) -> list[dict]:
    """
    Apply Dalio's Big Debt Crises tripwires. Each indicator has a flag level he
    associates with elevated crisis risk historically.
    """
    fred = snap.get("fred", {}) or {}
    rules = [
        # (key, label, flag if value >=, units, dalio_threshold_note)
        ("federal_debt_to_gdp", "Federal debt / GDP",          100, "%",  "Above 100% historically increases vulnerability to confidence shocks"),
        ("debt_service_ratio",  "HH debt service / income",    11,  "%",  "Above 11% historically pressures consumption (Dalio: ~12% pre-GFC)"),
        ("real_ten_year",       "10y real yield",              2.0, "%",  "Above 2% real tightens financial conditions on debtors"),
        ("hy_spread",           "HY credit spread (OAS)",      6.0, "%",  "Above 6% indicates corporate-credit stress"),
        ("yield_curve_10_2",    "10y-2y curve (inverted if <0)", 0,  "pp", "Persistent inversion historically precedes recession 6-18mo"),
    ]
    flags = []
    for key, label, threshold, units, note in rules:
        s = fred.get(key) or {}
        val = s.get("latest_value")
        if val is None:
            flags.append({"key": key, "label": label, "value": None, "status": "no_data", "note": note})
            continue
        # Inverted curve uses < 0 as the flag, others use >= threshold
        flagged = (val < threshold) if key == "yield_curve_10_2" else (val >= threshold)
        flags.append({
            "key": key,
            "label": label,
            "value": val,
            "units": units,
            "threshold": threshold,
            "status": "flag" if flagged else "ok",
            "note": note,
        })
    return flags


def all_weather_template() -> dict:
    """
    Bridgewater's All Weather portfolio is the canonical risk-parity template.
    Used as a benchmark to compare the user's actual allocation against a
    diversified-by-risk baseline.
    """
    return {
        "description": (
            "Risk-parity benchmark: equal risk contribution across asset classes, "
            "not equal capital. Approximate weights (one common formulation)."
        ),
        "weights": {
            "long_bonds":      0.40,   # TLT-equivalent
            "stocks":          0.30,   # SPY-equivalent
            "intermediate":    0.15,   # IEF-equivalent
            "commodities":     0.075,  # DBC-equivalent
            "gold":            0.075,  # GLD-equivalent
        },
        "note": (
            "Holds bonds in deflationary/risk-off regimes, gold/commodities in "
            "inflationary regimes, equities in growth regimes — designed to "
            "perform across all four quadrants."
        ),
    }


def refresh_macro() -> dict:
    snap = {"fred": {}, "etf_proxies": {}}
    if FRED_KEY:
        for key, sid, _label in FRED_SERIES:
            snap["fred"][key] = fred_series(sid)
            time.sleep(0.1)
    snap["etf_proxies"] = etf_proxies()
    snap["regime"] = classify_regime(snap)
    snap["big_debt_crisis"] = big_debt_crisis_tripwires(snap)
    snap["all_weather"] = all_weather_template()
    snap["asof"] = dt.datetime.utcnow().isoformat() + "Z"
    snap["fred_key_present"] = bool(FRED_KEY)
    (DATA / "macro.json").write_text(json.dumps(snap, indent=2, default=str))
    print(f"macro.json written. FRED key present: {bool(FRED_KEY)}. Regime: {snap['regime']['regime_name']}")
    return snap


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prices-only", action="store_true")
    ap.add_argument("--macro-only", action="store_true")
    ap.add_argument("--throttle", type=float, default=0.4)
    args = ap.parse_args()

    manifest = {"asof": dt.datetime.utcnow().isoformat() + "Z"}

    if not args.macro_only:
        prices = refresh_prices(throttle=args.throttle)
        manifest["prices"] = {"count": prices["count"], "failed": prices["failed"]}

    if not args.prices_only:
        macro = refresh_macro()
        manifest["macro"] = {
            "regime": macro["regime"]["regime_name"],
            "fred_key": macro["fred_key_present"],
        }

    (DATA / "last_updated.json").write_text(json.dumps(manifest, indent=2, default=str))
    print("done.")


if __name__ == "__main__":
    main()
