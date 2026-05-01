# The Compendium

Two ledgers, one framework. Plus an allocation engine and a macro overlay.

A working framework for measuring quality, durability, and asymmetric upside across
public equities, with disciplined sizing rules and a Ray Dalio-inspired macro layer.

**Educational use only — not investment advice.**

---

## Architecture

```
Compendium/
├── index.html                       Vol I  — Landing (two ledgers + appendix)
├── five-pillar-scorer.html          Vol I  — Core Ledger (defensive compounders)
├── watch-opportunity-ledger.html    Vol I  — Watch Sleeve (asymmetric bets)
├── company.html                     Vol I  — Single-company detail page
├── allocation.html                  Vol II — Sizing & concentration engine
├── macro.html                       Vol III — Dalio macro overlay
├── data/
│   ├── core.json                    Universe + fundamentals (Core)
│   ├── watch.json                   Universe + fundamentals (Watch)
│   ├── prices.json                  Live prices + valuation (refreshed daily)
│   ├── macro.json                   Macro indicators + regime classification
│   ├── positions.json               Your actual positions (you edit this)
│   └── last_updated.json            Refresh manifest
├── assets/
│   ├── data-core.js                 Core scoring functions + embedded snapshot
│   ├── data-watch.js                Watch scoring functions + embedded snapshot
│   ├── data-loader.js               Async JSON loader (used by Vol II/III)
│   ├── glossary.js                  Plain-English term definitions
│   ├── tooltip.css/js               Hover tooltips
├── scripts/
│   └── refresh_data.py              Pulls live prices + macro into /data/*.json
└── .github/workflows/
    └── refresh-data.yml             Daily auto-refresh via GitHub Actions
```

---

## How the data layer works

The original Compendium had hardcoded numbers in JavaScript files. That's been
replaced with a layered system:

1. **`data/core.json` and `data/watch.json`** are the universe + qualitative fields
   (moat scores, vintage, regulatory exposure, cluster tags, your written notes).
   These change quarterly with earnings — update them by hand.

2. **`data/prices.json`** is regenerated daily by `scripts/refresh_data.py` using
   yfinance. It contains volatile fields: price, P/E, PEG, gross margin, FCF yield,
   forward growth, beta, 52-week range, short interest.

3. **`data/macro.json`** is regenerated daily with FRED economic data (if a key
   is set) or yfinance ETF proxies as fallback. It contains the four-quadrant
   regime classification, Dalio Big Debt Crises tripwires, and the All-Weather
   template.

4. **`data/positions.json`** is your actual portfolio. The allocation page reads
   it and tells you which sizing rules you're breaching.

5. **`assets/data-loader.js`** fetches all four JSON files at runtime. Vol II
   (allocation) and Vol III (macro) use it. Vol I pages still use embedded data
   for now — they'll be migrated in Phase 2.

---

## Running the refresh script locally

```bash
cd Compendium
pip install yfinance pandas requests

# Optional: get a free FRED key for full macro coverage
# https://fred.stlouisfed.org/docs/api/api_key.html
export FRED_API_KEY="your_key_here"

# Refresh everything
python3 scripts/refresh_data.py

# Or just one piece
python3 scripts/refresh_data.py --prices-only
python3 scripts/refresh_data.py --macro-only
```

Open `index.html` in a browser. Vol II and Vol III will pick up the fresh data
automatically.

---

## Setting up GitHub Action auto-refresh

1. Push the repo to GitHub.
2. Get a free FRED API key at https://fred.stlouisfed.org/docs/api/api_key.html
3. In the repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `FRED_API_KEY`
   - Value: your key
4. **Settings → Actions → General → Workflow permissions** → set to "Read and write".
5. The action runs weekdays at 22:00 UTC (after US close). You can also run it
   manually from the **Actions** tab → "Refresh Compendium Data" → "Run workflow".

The action commits the updated `data/*.json` files back to the repo, so any host
that serves the repo (GitHub Pages, Netlify, Vercel) automatically gets fresh
data.

---

## Adding a new ticker

1. Open `data/core.json` (or `data/watch.json`).
2. Append a new company object — match the shape of existing entries.
3. Add a `cluster` field. Use an existing cluster name when relevant; invent a
   new one only when the new name doesn't fit any existing thesis.
4. Save. Next refresh will pick up the live price/multiples.

Cluster naming convention: `<theme>_<modifier>` (snake_case). Examples in use:
`mag7_platforms`, `glp1_franchise`, `payments_network`, `ai_capex_silicon`,
`uranium_cycle`, `gene_editing`, `em_latam_consumer`, `consumer_staples`.

---

## The Dalio macro overlay

Four frameworks layered on the same data:

1. **Four economic regimes** — Growth (up/down) × Inflation (up/down) → quadrant.
   Each quadrant has historical asset-tilt prescriptions. Currently classified
   from real GDP YoY and core CPI YoY (FRED) or SPY trend and TIPS-IEF spread
   (proxy fallback).

2. **Big Debt Crises tripwires** — From Dalio's 2018 book. Five quantitative
   indicators (debt/GDP, household debt service, real 10Y, HY spreads, yield
   curve) compared against historical flag thresholds.

3. **Big Cycle / Long-term debt cycle** — Qualitative narrative on which phase
   of the long arc the US sits in. Currently late phase 4.

4. **All-Weather benchmark** — Bridgewater's risk-parity template (40% long bonds,
   30% stocks, 15% intermediate, 7.5% commodities, 7.5% gold). Used as the
   diversification counter-example to your concentrated thesis.

The classification is rule-based and intentionally mechanical. It will be wrong
at turning points. Pair regime calls with primary sources before acting.

---

## The allocation engine

Six rules, all conservative defaults — adjust to your risk tolerance:

| Rule | Cap |
|---|---|
| Per-name cap, Core sleeve | 8% |
| Per-name cap, Watch sleeve | 3% |
| Per-cluster cap, Core sleeve | 25% |
| Per-cluster cap, Watch sleeve | 12% |
| Total Watch sleeve | 20% |
| Cash floor (regime-adjusted) | 10–25% |

Cash target shifts by regime: Goldilocks 10%, Reflation 15%, Deflation 20%,
Stagflation 25%. The engine reads `data/positions.json` and surfaces every
breach with the dollar amount needed to fix it.

---

## Conventions

- `t` is ticker, `n` is full name, `cat` is sector category, `col` is brand color.
- `_live: true` on a merged company object means live data overrode the embedded
  snapshot for that field.
- `_asof` timestamps every record with a UTC datetime.
- Underscored keys (`_source`, `_asof`, `_live`, `_price`) are metadata and
  should not be displayed as company fields.

---

## Phase 2 — known follow-ups

- Migrate the Vol I pages (five-pillar-scorer, watch-opportunity-ledger,
  company) to use `data-loader.js` so they pick up live prices automatically.
  Currently they still render from their embedded inline data.
- Add a tracked-portfolio view on company.html showing how your position is
  performing vs. the framework's verdict at entry.
- Add a notification system for catalyst dates (PDUFA, trial readouts, earnings).
- Add a portfolio backtester that replays the framework's historical scores.

---

Created by Andres D. Montbrun. © MMXXVI.
