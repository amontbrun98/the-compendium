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


def fetch_ticker(display_t: str, yf_symbol: str | None = None) -> dict:
    """Pull the volatile fields we want refreshed daily for a single ticker.

    `display_t` is the ticker shown to humans and used as the join key in
    core.json / watch.json. `yf_symbol` is the yfinance API symbol when it
    differs (e.g. BRK.B → BRK-B, NESN → NESN.SW). Falls back to display_t.
    """
    api_symbol = yf_symbol or display_t
    try:
        t = yf.Ticker(api_symbol)
        info = t.info or {}
    except Exception as exc:  # noqa: BLE001
        return {"t": display_t, "error": str(exc)[:200]}

    # Build a focused payload — ignore the 100+ junk fields yfinance returns
    payload = {
        "t": display_t,
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


def load_universe() -> list[tuple[str, str]]:
    """Return list of (display_ticker, yf_symbol) tuples.

    Companies with a `yf` field in core.json/watch.json use that as the
    yfinance API symbol while keeping the human-friendly ticker as the
    display + join key (e.g. BRK.B → BRK-B, NESN → NESN.SW).
    """
    pairs: dict[str, str] = {}
    for fname in ("core.json", "watch.json"):
        path = DATA / fname
        if not path.exists():
            continue
        for c in json.loads(path.read_text()):
            t = c.get("t")
            if not t:
                continue
            pairs[t] = c.get("yf") or t
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
    for b in benchmarks:
        pairs.setdefault(b, b)
    return sorted(pairs.items(), key=lambda p: p[0])


def refresh_prices(throttle: float = 0.4) -> dict:
    universe = load_universe()
    out: list[dict] = []
    failed: list[str] = []
    for i, (display_t, yf_symbol) in enumerate(universe, 1):
        row = fetch_ticker(display_t, yf_symbol)
        if "error" in row:
            failed.append(display_t)
        # Flag rows that came back with no usable price even if no exception
        elif row.get("price") is None and row.get("marketCap") is None:
            failed.append(display_t)
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
# HISTORICAL RETURNS — for the backtest page
#
# This is NOT a true backtest of the framework. ROIC, moat, vintage, and
# regulatory inputs are curated and frozen at the most recent review. We can't
# recompute the composite score historically because we don't have a time-series
# of those curated fields. What this section produces is total-return data per
# ticker over standard windows (1m, 3m, YTD, 1y, 3y annualised, 5y annualised),
# plus an SPY benchmark, so the backtest page can answer one specific question:
# "Did the names that score well in the framework's most recent reading actually
# compound over the prior 1/3/5 years?"
#
# Survivorship bias caveat: the universe is "names still in the ledger today."
# Any company that scored well 5 years ago and went to zero is not in the
# dataset. That's a known limitation; surface it on the page.
# ---------------------------------------------------------------------------

def _annualised(total_return: float, years: float) -> float | None:
    """Convert a total return over `years` years into an annualised rate."""
    if total_return is None or years <= 0:
        return None
    base = 1.0 + total_return
    if base <= 0:
        return None
    return base ** (1.0 / years) - 1.0


def fetch_returns(display_t: str, yf_symbol: str | None = None) -> dict:
    """Pull 5y daily history and compute total returns at standard windows."""
    api_symbol = yf_symbol or display_t
    try:
        hist = yf.Ticker(api_symbol).history(period="5y", auto_adjust=True)
    except Exception as exc:  # noqa: BLE001
        return {"t": display_t, "error": str(exc)[:200]}

    if hist is None or hist.empty or "Close" not in hist:
        return {"t": display_t, "error": "no history"}

    # Drop tz info and keep only the close column for simplicity
    closes = hist["Close"].dropna()
    if len(closes) < 2:
        return {"t": display_t, "error": "insufficient history"}

    today = closes.index[-1]
    last = float(closes.iloc[-1])

    def total_return_at(target_days_back: int) -> float | None:
        # Find the closest trading day at-or-before the target date
        cutoff = today - dt.timedelta(days=target_days_back)
        eligible = closes[closes.index <= cutoff]
        if eligible.empty:
            return None
        prior = float(eligible.iloc[-1])
        if prior <= 0:
            return None
        return last / prior - 1.0

    # YTD: from first trading day of current calendar year
    ytd_cutoff = dt.datetime(today.year, 1, 1, tzinfo=today.tzinfo) if today.tzinfo else dt.datetime(today.year, 1, 1)
    ytd_eligible = closes[closes.index >= ytd_cutoff]
    ytd_return = (last / float(ytd_eligible.iloc[0]) - 1.0) if not ytd_eligible.empty else None

    r1m = total_return_at(30)
    r3m = total_return_at(91)
    r1y = total_return_at(365)
    r3y_total = total_return_at(365 * 3)
    r5y_total = total_return_at(365 * 5)

    return {
        "t": display_t,
        "1m": r1m,
        "3m": r3m,
        "ytd": ytd_return,
        "1y": r1y,
        "3y_ann": _annualised(r3y_total, 3.0),
        "5y_ann": _annualised(r5y_total, 5.0),
        "first_close": float(closes.iloc[0]),
        "last_close": last,
        "history_start": closes.index[0].strftime("%Y-%m-%d"),
        "history_end": today.strftime("%Y-%m-%d"),
    }


def refresh_returns(throttle: float = 0.4) -> dict:
    """Generate data/returns.json — historical total returns per ticker plus SPY."""
    universe = load_universe()
    # Always include SPY as the equity baseline even if it isn't already a benchmark
    seen = {t for t, _ in universe}
    if "SPY" not in seen:
        universe = list(universe) + [("SPY", "SPY")]

    out: list[dict] = []
    failed: list[str] = []
    benchmarks: dict[str, dict] = {}
    for i, (display_t, yf_symbol) in enumerate(universe, 1):
        row = fetch_returns(display_t, yf_symbol)
        if "error" in row:
            failed.append(display_t)
        else:
            out.append(row)
            if display_t in {"SPY", "QQQ", "IWM", "TLT", "GLD"}:
                benchmarks[display_t] = {
                    k: row.get(k) for k in ("1m", "3m", "ytd", "1y", "3y_ann", "5y_ann")
                }
        time.sleep(throttle)
        if i % 10 == 0:
            print(f"  returns: fetched {i}/{len(universe)}", file=sys.stderr)

    payload = {
        "asof": dt.datetime.utcnow().isoformat() + "Z",
        "source": "yfinance",
        "windows": ["1m", "3m", "ytd", "1y", "3y_ann", "5y_ann"],
        "count": len(out),
        "failed": failed,
        "benchmarks": benchmarks,
        "rows": out,
        "_disclaimer": (
            "Historical total returns over fixed windows ending on the asof date. "
            "These returns are NOT a backtest of the framework's predictive power — "
            "the curated inputs (ROIC, moat, vintage, regulatory) are frozen at the "
            "most recent review and cannot be recomputed historically. Survivorship "
            "bias applies: companies that scored well in past years and exited the "
            "universe are not represented here."
        ),
    }
    (DATA / "returns.json").write_text(json.dumps(payload, indent=2, default=str))
    print(f"returns.json: {len(out)} rows, {len(failed)} failed")
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
    # Capital migration / cross-border sovereign indicators
    ("thirty_year",           "DGS30",           "30-year Treasury yield (%)"),
    ("term_premium_10y",      "THREEFYTP10",     "10-year ACM term premium estimate (%)"),
    ("foreign_treasuries",    "FDHBFIN",         "Foreign holdings of US Treasuries ($B, monthly)"),
    # International long yields (10Y proxies for 30Y — free FRED data only goes to 10Y reliably)
    ("japan_10y",             "IRLTLT01JPM156N", "Japan 10-year sovereign yield (%, monthly)"),
    ("uk_10y",                "IRLTLT01GBM156N", "UK 10-year sovereign yield (%, monthly)"),
    ("china_10y",             "IRLTLT01CNM156N", "China 10-year sovereign yield (%, monthly)"),
    ("germany_10y",           "IRLTLT01DEM156N", "Germany 10-year sovereign yield (%, monthly)"),
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
        # Capital migration proxies — yields and cross-border sovereign / FX
        ("us_30y_yield",    "^TYX", "US 30-year Treasury yield (index)"),
        ("us_10y_yield",    "^TNX", "US 10-year Treasury yield (index)"),
        ("intl_sovereign",  "BWX",  "International developed sovereign ex-US ETF"),
        ("em_sovereign",    "EMB",  "USD EM sovereign bond ETF"),
        ("intl_treasury",   "IGOV", "International Treasury ex-US ETF"),
        ("yen",             "FXY",  "Japanese yen ETF (JGB / BoJ proxy)"),
        ("sterling",        "FXB",  "British pound ETF (gilt / UK fiscal proxy)"),
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


def capital_migration(snap: dict) -> dict:
    """
    Cross-border sovereign-debt and capital-flow signals.

    Tracks the kind of stress that historically transmits a thesis like
    "AI concentration creates fragility" into actual market drawdowns —
    via the long end of the sovereign curve, term premium expansion,
    and rotation across G3 sovereign markets.

    Composite signals computed:
      - 30y / 10y curve slope (term premium proxy)
      - TLT vs. gold 30-day rolling correlation (flight-to-safety pattern)
      - US vs. international developed sovereign 3-mo return spread
      - Yen-gold relationship (BoJ policy stress proxy)
    """
    fred = snap.get("fred", {}) or {}
    proxies = snap.get("etf_proxies", {}) or {}

    # 1. Long-end curve slope: prefer FRED (DGS30 - DGS10), fallback to ^TYX/^TNX index ratio
    long_end_slope = None
    long_end_source = None
    dgs30 = (fred.get("thirty_year") or {}).get("latest_value")
    dgs10 = (fred.get("ten_year") or {}).get("latest_value")
    if dgs30 is not None and dgs10 is not None:
        long_end_slope = dgs30 - dgs10
        long_end_source = "FRED DGS30-DGS10"
    else:
        # ^TYX is reported as 10x yield (e.g. 4.85% → 48.5). Same for ^TNX.
        tyx = (proxies.get("us_30y_yield") or {}).get("latest")
        tnx = (proxies.get("us_10y_yield") or {}).get("latest")
        if tyx is not None and tnx is not None:
            long_end_slope = (tyx - tnx) / 10  # convert from index to actual %
            long_end_source = "yfinance ^TYX-^TNX"

    # 2. TLT-gold 30-day rolling correlation (flight-to-safety regime)
    tlt_gold_corr = None
    try:
        gld_hist = yf.Ticker("GLD").history(period="3mo", interval="1d")["Close"]
        tlt_ret = tlt_hist.pct_change().dropna()
        gld_ret = gld_hist.pct_change().dropna()
        common_idx = tlt_ret.index.intersection(gld_ret.index)
        if len(common_idx) >= 30:
            window = common_idx[-30:]
            tlt_gold_corr = float(tlt_ret.loc[window].corr(gld_ret.loc[window]))
    except Exception:
        pass

    us_intl_spread = None
    us_long = (proxies.get("longbonds") or {}).get("3mo_pct")
    intl_sov = (proxies.get("intl_sovereign") or {}).get("3mo_pct")
    if us_long is not None and intl_sov is not None:
        us_intl_spread = us_long - intl_sov

    yen_3mo = (proxies.get("yen") or {}).get("3mo_pct")
    gold_3mo = (proxies.get("gold") or {}).get("3mo_pct")
    fhold = fred.get("foreign_treasuries") or {}
    foreign_treasuries_trend = fhold.get("trend")
    foreign_treasuries_value = fhold.get("latest_value")
    term_prem = (fred.get("term_premium_10y") or {}).get("latest_value")

    flags = []
    if long_end_slope is not None and long_end_slope > 1.0:
        flags.append({"level": "watch", "msg": f"30y-10y slope at {long_end_slope:+.2f}pp - term premium expanding."})
    if long_end_slope is not None and long_end_slope > 1.5:
        flags.append({"level": "alert", "msg": f"30y-10y slope at {long_end_slope:+.2f}pp is meaningful - capital demanding more compensation for US duration."})
    if tlt_gold_corr is not None and tlt_gold_corr > 0.4:
        flags.append({"level": "watch", "msg": f"TLT-gold 30d corr at {tlt_gold_corr:+.2f} - bonds and gold rallying together is a flight-to-safety pattern."})
    if foreign_treasuries_trend == "down":
        flags.append({"level": "alert", "msg": "Foreign holdings of US Treasuries falling on the latest print - net seller flow."})
    if yen_3mo is not None and yen_3mo > 5:
        flags.append({"level": "watch", "msg": f"Yen +{yen_3mo:.1f}% over 3mo - possible carry unwind / Japan repatriation pressure."})

    # International sovereign 10Y yields + spreads vs US 10Y
    us_10y_val = (fred.get("ten_year") or {}).get("latest_value")
    sovereigns = []
    for code, label in [("japan_10y", "Japan"), ("uk_10y", "United Kingdom"),
                        ("china_10y", "China"), ("germany_10y", "Germany")]:
        s = fred.get(code) or {}
        v = s.get("latest_value")
        if v is None: continue
        spread = (v - us_10y_val) if us_10y_val is not None else None
        sovereigns.append({
            "country": label, "yield_10y": v, "trend": s.get("trend"),
            "latest_date": s.get("latest_date"),
            "spread_vs_us_10y": spread,
            # interpretation hint
            "signal": (
                "Capital staying home — repatriation pressure on USTs" if (s.get("trend") == "up" and label == "Japan")
                else "Fiscal stress — UK pension/LDI risk if extreme" if (s.get("trend") == "up" and label == "United Kingdom")
                else "Disinflation / capital flight to safety" if (s.get("trend") == "down" and label == "China")
                else None
            ),
        })

    # Manual 30Y override panel — the user can populate these when they have current data
    # since FRED doesn't carry international 30Y reliably.
    manual_30y = {
        "_doc": (
            "FRED's international yield series only go to 10Y. Update these quarterly from "
            "tradingeconomics.com / worldgovernmentbonds.com. Set value=null when unsure."
        ),
        "us_30y": (fred.get("thirty_year") or {}).get("latest_value"),
        "japan_30y": None,           # tradingeconomics: ~3.72% as of May 2026
        "uk_30y": None,              # tradingeconomics: ~5.78% as of May 2026 (28-year high)
        "china_30y": None,           # tradingeconomics: ~2.28% as of April 2026
        "germany_30y": None,
    }

    if any(s.get("country") == "Japan" and s.get("trend") == "up" for s in sovereigns):
        flags.append({
            "level": "watch",
            "msg": "Japan 10Y yield trending up — JGB sell-off raises Japanese investor incentive to repatriate from USTs."
        })
    uk = next((s for s in sovereigns if s.get("country") == "United Kingdom"), None)
    if uk and uk.get("yield_10y") and us_10y_val and uk["yield_10y"] - us_10y_val > 0.5:
        flags.append({
            "level": "alert",
            "msg": f"UK 10Y at {uk['yield_10y']:.2f}% trades {(uk['yield_10y']-us_10y_val):+.2f}pp over US 10Y — gilt market under fiscal stress."
        })

    return {
        "long_end_slope_pp": long_end_slope,
        "long_end_source": long_end_source,
        "term_premium_10y": term_prem,
        "tlt_gold_30d_corr": tlt_gold_corr,
        "us_intl_sov_spread_3mo": us_intl_spread,
        "yen_3mo_pct": yen_3mo,
        "gold_3mo_pct": gold_3mo,
        "foreign_treasuries_value": foreign_treasuries_value,
        "foreign_treasuries_trend": foreign_treasuries_trend,
        "sovereigns_10y": sovereigns,
        "manual_30y": manual_30y,
        "flags": flags,
        "explainer": (
            "Tracks the cross-border transmission channel. Long-end curve slope is the term-premium signal. "
            "TLT-gold correlation flags flight-to-safety. International 10Y yields proxy the relative "
            "incentive for foreign investors to repatriate from USTs (when their own yields rise) or "
            "flee to USTs (when they fall sharply). Spreads vs US 10Y are the carry signal. "
            "30Y data for non-US sovereigns is paywalled; update manual_30y quarterly."
        ),
    }


def all_weather_template() -> dict:
    return {
        "description": "Risk-parity benchmark: equal risk contribution across asset classes, not equal capital.",
        "weights": {
            "long_bonds":   0.40,
            "stocks":       0.30,
            "intermediate": 0.15,
            "commodities":  0.075,
            "gold":         0.075,
        },
        "note": (
            "Holds bonds in deflationary regimes, gold/commodities in inflationary regimes, "
            "equities in growth regimes - designed to perform across all four quadrants."
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
    snap["capital_migration"] = capital_migration(snap)
    snap["asof"] = dt.datetime.utcnow().isoformat() + "Z"
    snap["fred_key_present"] = bool(FRED_KEY)
    (DATA / "macro.json").write_text(json.dumps(snap, indent=2, default=str))
    print(f"macro.json written. FRED key present: {bool(FRED_KEY)}. Regime: {snap['regime']['regime_name']}")
    return snap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prices-only",  action="store_true",
                    help="Refresh data/prices.json only.")
    ap.add_argument("--macro-only",   action="store_true",
                    help="Refresh data/macro.json only.")
    ap.add_argument("--returns-only", action="store_true",
                    help="Refresh data/returns.json only (used by backtest.html).")
    ap.add_argument("--with-returns", action="store_true",
                    help="In addition to prices and macro, refresh data/returns.json. "
                         "Adds ~1 minute to the run because it pulls 5y daily history "
                         "for every ticker.")
    ap.add_argument("--throttle",     type=float, default=0.4)
    args = ap.parse_args()

    # Determine which sections to run. Explicit --*-only flags win.
    do_prices  = args.prices_only  or (not args.macro_only and not args.returns_only)
    do_macro   = args.macro_only   or (not args.prices_only and not args.returns_only)
    do_returns = args.returns_only or args.with_returns

    manifest = {"asof": dt.datetime.utcnow().isoformat() + "Z"}

    if do_prices:
        prices = refresh_prices(throttle=args.throttle)
        manifest["prices"] = {"count": prices["count"], "failed": prices["failed"]}

    if do_macro:
        macro = refresh_macro()
        manifest["macro"] = {
            "regime": macro["regime"]["regime_name"],
            "fred_key": macro["fred_key_present"],
        }

    if do_returns:
        returns = refresh_returns(throttle=args.throttle)
        manifest["returns"] = {
            "count": returns["count"],
            "failed": returns["failed"],
            "windows": returns["windows"],
        }

    # Preserve any prior section's manifest entries when running in --*-only mode
    # (otherwise a returns-only run would wipe the prices manifest entry).
    if (DATA / "last_updated.json").exists():
        try:
            existing = json.loads((DATA / "last_updated.json").read_text())
            for key in ("prices", "macro", "returns"):
                if key not in manifest and key in existing:
                    manifest[key] = existing[key]
        except Exception:  # noqa: BLE001
            pass

    (DATA / "last_updated.json").write_text(json.dumps(manifest, indent=2, default=str))
    print("done.")


if __name__ == "__main__":
    main()
