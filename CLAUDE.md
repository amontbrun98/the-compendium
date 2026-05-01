# The Compendium — Project Memory for Claude Code

This file gives any Claude session (Claude Code CLI, Cowork, Web UI) enough
context to work productively on The Compendium without having to rediscover
the architecture or conventions.

**Owner:** Andres D. Montbrun
**Repo:** https://github.com/amontbrun98/the-compendium
**License:** Educational use only — not investment advice.

---

## What this project is

The Compendium is a personal investment-research framework that combines:

- **Two opinionated ledgers** that score companies on different criteria
- **An allocation engine** that enforces sizing and concentration discipline
- **A Dalio-inspired macro overlay** that classifies the regime and tracks cross-border capital migration
- **A live data layer** that auto-refreshes daily via GitHub Actions

The site is static (HTML + vanilla JS, no framework), hosted on GitHub Pages /
Netlify / Vercel. The deliberate design choice is that everything is an
opinionated "thinking instrument," not a generic screener.

---

## Architecture

```
Compendium/
├── index.html                       Vol I  — Landing (two ledgers + appendix)
├── five-pillar-scorer.html          Vol I  — Core Ledger (defensive compounders)
├── watch-opportunity-ledger.html    Vol I  — Watch Sleeve (asymmetric bets)
├── company.html                     Vol I  — Per-company detail page
├── allocation.html                  Vol II — Sizing & stress test engine
├── macro.html                       Vol III — Dalio macro overlay
├── data/
│   ├── core.json                    Universe + qualitative fields (Core)
│   ├── watch.json                   Universe + qualitative fields (Watch)
│   ├── prices.json                  Live prices + valuation (refreshed daily)
│   ├── macro.json                   Regime classification + Dalio frameworks
│   ├── positions.json               Demo seed positions (allocation page reads localStorage primarily)
│   └── last_updated.json            Refresh manifest
├── assets/
│   ├── data-core.js                 Core scoring functions + embedded snapshot
│   ├── data-watch.js                Watch scoring functions + embedded snapshot
│   ├── data-loader.js               Async JSON loader (used by Vol II/III)
│   ├── portfolio-bridge.js          Auto-injects "+ add" buttons on ledger pages
│   ├── glossary.js                  Plain-English term definitions
│   ├── tooltip.css/js               Hover tooltips
├── scripts/
│   └── refresh_data.py              Pulls live prices + macro into /data/*.json
├── requirements.txt                 Python deps for refresh script
├── .github/workflows/
│   └── refresh-data.yml             Daily auto-refresh (race-safe with rebase retry)
├── .gitattributes                   Line ending normalization (CRLF→LF)
├── .gitignore                       Excludes .env, .claude/, etc.
└── README.md                        Public-facing docs
```

---

## The frameworks

### Five Pillar Ledger (Core sleeve — defensive compounders)

Each company is scored on:

| Pillar | Weight | What it measures |
|---|---|---|
| Quality | 30% | ROIC – WACC spread (non-linear curve) |
| Durability | 20% | Gross margin × trend × moat (4-component avg) |
| Growth | 20% | sqrt curve on (forward EPS + FCF growth)/2 × trend multiplier |
| Valuation | 20% | (5−PEG)/4 × 0.5 + FCF Yield/5 × 0.5 |
| Regulatory | 10% | Regulatory score − customer concentration penalty |

**Vintage multiplier** scales Quality (and partially Durability) based on how
long the company has sustained current excellence:
- 1.00 (Aged): 10+ years at current quality
- 0.85 (Mature): 5–10 years
- 0.70 (Young): 2–5 years
- 0.55 (Fresh): <2 years

Example: PLTR scores 8.52 on raw Quality but vintage 0.55 cuts it to 4.69 —
because consistent profitability since 2023 only is not the same as Apple's
two decades.

**`marketGapV2`** solves for the implied growth required for the current P/E
to converge to a target multiple (default 20) over 5 years, then compares to
consensus growth. Gap > 0 = market underpricing growth; gap < 0 = priced for
perfection.

### Watch Opportunity Ledger (Watch sleeve — asymmetric bets)

Six pillars (different question — "what could it become"):

| Pillar | Weight |
|---|---|
| Market Expansion | 20% |
| Revenue Trajectory | 20% |
| Edge / Moat | 15% |
| Capital Efficiency | 15% |
| Asymmetry Setup | 15% |
| Valuation Reasonableness | 15% |

Names tagged across 8 correlation profiles: tech, bio, resource, financial,
consumer, industrial, space, em. Used for sleeve diversification.

### Allocation Engine (allocation.html)

Enforces six rules:

| Rule | Cap |
|---|---|
| Per-name cap, Core | 8% |
| Per-name cap, Watch | 3% |
| Per-cluster cap, Core | 25% |
| Per-cluster cap, Watch | 12% |
| Total Watch sleeve | 20% |
| Cash floor | 10–25% (regime-adjusted) |

Workflow on the page:
1. **Section №01 — Auto-balance from seeds.** Pick tickers, set capital, click Generate. Engine respects all caps.
2. **Section №02 — Refine.** Manual add, edit, remove. Inline cap warnings on each row.
3. **Section №03 — Concentration & Breaches.** Cluster bars with × clear buttons.
4. **Section №04 — Stress Test.** Preset scenarios + custom shock by ticker/cluster/sleeve.

State persists in `localStorage` under `compendium_positions_v1`.
Export-as-JSON and Import-from-JSON for committing to the repo.

### Dalio Macro Overlay (macro.html)

Four frameworks layered on the same data:

1. **Four Economic Regimes (Quadrant model).** Growth × Inflation → Goldilocks / Reflation / Deflation / Stagflation. Asset tilt prescriptions per quadrant.
2. **Big Debt Crises Tripwires.** Five quantitative indicators from FRED with historical flag thresholds (federal debt/GDP > 100%, household debt service > 11%, real 10y > 2%, HY spread > 6%, yield curve inverted).
3. **Big Cycle.** Long-term debt cycle + internal/external order. Currently classified as US late phase 4.
4. **All Weather Template.** Bridgewater risk-parity benchmark (40% long bonds, 30% stocks, 15% intermediate, 7.5% gold, 7.5% commodities) as comparison to user's actual allocation.
5. **Capital Migration.** 30y-10y curve slope, 10y term premium, foreign UST holdings trend, TLT-gold correlation, yen/sterling cross-asset moves. Tracks the cross-border transmission channel — JGB/BoJ stress, UK gilt fragility, foreign Treasury flows.

---

## The data layer

### Static JSON in `/data/`

- **`core.json` and `watch.json`** are the source of truth for the universe + qualitative fields (moat scores, vintage, regulatory, cluster tags, written notes). Updated **manually quarterly with earnings**.
- **`prices.json`** is regenerated **daily** by `scripts/refresh_data.py` using yfinance. Volatile fields: price, P/E, PEG, gross margin, FCF yield, forward growth, beta, 52-week range, short interest.
- **`macro.json`** is regenerated **daily** with FRED economic data + yfinance ETF proxies. Contains regime classification, Big Debt Crises tripwires, capital migration block, All-Weather template.
- **`positions.json`** is a demo seed. The allocation page primarily reads from `localStorage`.
- **`last_updated.json`** is a manifest of when each data file was last refreshed.

### Refresh pipeline

`scripts/refresh_data.py` does both prices and macro. Run locally:
```bash
export FRED_API_KEY="your_key"   # free at fred.stlouisfed.org
python3 scripts/refresh_data.py
# or just one piece:
python3 scripts/refresh_data.py --prices-only
python3 scripts/refresh_data.py --macro-only
```

Without FRED_API_KEY, the script falls back to ETF-based proxies for macro.

### GitHub Action

`.github/workflows/refresh-data.yml` runs the script weekdays at 22:00 UTC.
- Requires repo secret `FRED_API_KEY`
- Requires Settings → Actions → General → Workflow permissions = "Read and write"
- Race-safe: if push is rejected, it rebases on origin/main and retries up to 3 times

---

## Conventions

### Cluster naming

`<theme>_<modifier>` in snake_case. Currently in use across the universe:

- `mag7_platforms` (GOOGL, AAPL, META, MSFT, AMZN, TSLA)
- `ai_capex_silicon` (NVDA, CRDO, TSM, ASML)
- `glp1_franchise` (LLY, NVO, HIMS)
- `payments_network` (V, MA)
- `consumer_staples` (NESN, COST, WMT)
- `consumer_brands` (NKE, SBUX, CELH)
- `enterprise_saas` (NOW, CRM, ADBE)
- `healthcare_legacy` (UNH)
- `financial_diversified` (BRK.B)
- `us_banks` (JPM)
- `energy_majors` (XOM)
- `industrial_silicon` (TXN)
- `streaming_media` (NFLX)
- `ai_software` (PLTR)
- `crypto_treasury` (MSTR)
- `em_china` (BABA)
- `em_latam_consumer` (MELI)
- `em_latam_finance` (NU)
- `edge_infra` (NET)
- `industrial_iot` (IOT)
- `gene_editing` (CRSP, BEAM)
- `ai_drug_discovery` (RXRX, SDGR)
- `space_infra` (RKLB)
- `observability_saas` (DDOG)
- `data_cloud` (SNOW)
- `commerce_infra` (SHOP)
- `uranium_cycle` (CCJ, NXE)
- `precious_metals` (WPM)
- `lithium_cycle` (ALB)
- `crypto_infra` (COIN)
- `retail_finance` (HOOD)

### Code conventions

- Vanilla JS, no framework, no build step
- Static HTML pages share `assets/` modules
- Vol II/III pages load data via `assets/data-loader.js` (async, with sessionStorage cache)
- Vol I pages still use embedded inline data (Phase 2 todo: migrate to data-loader)
- Underscored keys (`_asof`, `_live`, `_source`) are metadata and should not be displayed as fields
- Editorial design: Fraunces serif + IBM Plex Mono, dark paper aesthetic with #e85d3d accent

### Investment context (the user's working thesis)

The user holds a two-layer thesis worth knowing:

1. **Macro layer:** US equity indices are unusually concentrated in a small number of AI-exposed names (Mag 7 ≈ 33–35% of S&P 500). Combined with CAPE near 40 and ~$700B in 2026 hyperscaler AI capex, this creates structural fragility. A rotation has already partly begun (Mag 7 –7% YTD vs. S&P 493 +4% as of mid-2026).

2. **Sector layer:** GLP-1 / obesity therapeutics is a defensible non-AI rotation target. Real revenue growth ($53B → $130–157B by 2030), secular demand, oral GLP-1 catalyst (FDA approval of Lilly's orforglipron), and a clear pipeline of next-gen players (Viking VK2735).

Important nuance: the rotation is real but **broad healthcare (XLV) is also down 7% YTD** — name selection within healthcare is doing all the work. NVO scores higher than LLY on the framework (spread 48 vs 31, ROIC 55 vs 40, P/E 18 vs 26, vintage 1.00 vs 0.85) despite getting less press.

Current macro regime (per the engine): **Reflation (Q2)** — Growth ↑ Inflation ↑.
Big Debt Crises tripwires flagged: Federal debt/GDP at 122.6%, household debt service at 11.3%.

---

## What's built (status)

### Done

- ✅ Vol I — Five Pillar Ledger, Watch Opportunity Ledger, company detail page (original embedded data)
- ✅ Vol II — Allocation Engine with auto-balance, manual edit, stress test, cluster clear
- ✅ Vol III — Macro overlay with all four Dalio frameworks + Capital Migration
- ✅ Data layer — JSON files + Python refresh script + GitHub Action (race-safe)
- ✅ Portfolio bridge — "+ add" buttons on ledger pages with saturation check
- ✅ Macro Validation Brief (DOCX) — initial thesis writeup

### Phase 2 follow-ups (not yet done)

1. **Migrate Vol I pages to live data.** Right now five-pillar-scorer, watch-opportunity-ledger, and company still render from inline embedded data. Should refactor to use `data-loader.js` so live prices flow into the score.
2. **Catalyst calendar.** Add a `nextCatalyst` field per company (date, type, what_it_means_if_hit, what_it_means_if_missed) and an upcoming-events view. Highest value for Watch sleeve names (PDUFA dates, trial readouts).
3. ~~**Fix three failed tickers.** BRK.B needs to be `BRK-B`, NESN needs `NESN.SW`, the 7203 entry isn't even in the universe (Toyota, my benchmark mistake).~~ **Done 2026-05-01:** Introduced an optional `yf` field on company entries — display ticker stays human-readable (`BRK.B`, `NESN`) while the refresh script uses the override symbol (`BRK-B`, `NESN.SW`). Toyota dropped from the watch ledger. `refresh_data.py` now also flags silently-empty rows in the `failed` array so future cases don't go unnoticed.
4. **Position-tracking on company.html.** Show how a position is performing vs. the framework's verdict at entry.
5. **Backtester.** Replay framework scores against historical price data.
6. **Migrate inline ledger data to JSON.** The HTML files duplicate data already in core.json/watch.json. Single source of truth would prevent drift.

---

## How to extend

### Add a new ticker
1. Open `data/core.json` or `data/watch.json`
2. Append a new company object matching the existing shape
3. Set the `cluster` field (use existing names when possible)
4. Save. Next refresh picks up the live price/multiples

### Add a new macro indicator
1. In `scripts/refresh_data.py`, add to `FRED_SERIES` list (key, FRED series ID, label)
2. If you want it in the Big Debt Crises tripwires, add to `big_debt_crisis_tripwires()`
3. If you want it on the page, add a status cell or table row in `macro.html`

### Add a new allocation rule
1. Update `RULES` constant in `allocation.html` (and `assets/portfolio-bridge.js` if it's a cap)
2. Update the rule render in section №01
3. Add breach detection in the `render()` function

---

## Quick commands

```bash
# Install python deps
pip install -r requirements.txt

# Refresh everything locally
export FRED_API_KEY="your_key"
python3 scripts/refresh_data.py

# Trigger the GitHub Action manually
# Go to: Actions tab → "Refresh Compendium Data" → "Run workflow"

# Open locally (no server needed for read-only mode)
# Just open index.html in a browser

# Push changes
git add .
git commit -m "..."
git push
```

---

## Notes for any future Claude session

- The user is not a developer. Use editorial-quality prose; format conservatively. They appreciate craft and aesthetics.
- The user invests with real money. Always pair recommendations with risk caveats. Never recommend specific securities.
- The user is comfortable with the framework but new to git. Walk through commands carefully, prefer Notepad over vim (`git config --global core.editor notepad` was set).
- The Linux sandbox FUSE mount sometimes shows stale views of files edited via the file tools. Trust the file tool's view; bash views may be cached.
