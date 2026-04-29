// The Compendium — Plain-English glossary
// Each entry: { title, body }. Body is 1–3 sentences, beginner-friendly, no jargon-defining-jargon.
window.GLOSSARY = {

  // =========================================================
  // CORE LEDGER PILLARS (Five Pillar)
  // =========================================================
  'quality': {
    title: 'Quality (30% weight)',
    body: 'Measures how much profit a business earns on every dollar of capital it uses. The higher the score, the better the business is at turning money invested into money returned. The single biggest pillar by weight because durable profits are the foundation of long-term returns.'
  },
  'durability': {
    title: 'Durability (20% weight)',
    body: 'Asks how long the company can keep its current advantages. Made up of gross margin, the trend in margins, and a moat score (brand, switching costs, network effects, scale). High durability = the profits should still be there in 10 years.'
  },
  'growth': {
    title: 'Growth (20% weight)',
    body: 'How fast revenue and free cash flow are expected to grow over the next several years. A company can be high quality and still be a poor investment if growth has stalled.'
  },
  'valuation': {
    title: 'Valuation (20% weight)',
    body: 'What you are paying for the business today relative to what it earns and grows. Combines PEG (price-to-earnings vs. growth) with FCF Yield (cash returned for the price). Lower price for the same business = better score.'
  },
  'regulatory': {
    title: 'Regulatory (10% weight)',
    body: 'External risks from governments, antitrust agencies, lawsuits, geopolitics, and customer concentration. A business can be excellent but still face an existential lawsuit or an export ban — this pillar discounts for that.'
  },

  // =========================================================
  // WATCH OPPORTUNITY PILLARS (Six Pillar)
  // =========================================================
  'market': {
    title: 'Market Expansion (20% weight)',
    body: 'How big the addressable market (TAM) is and whether it is growing. A great product in a tiny market caps your upside. This pillar scores how much room there is to grow into.'
  },
  'trajectory': {
    title: 'Revenue Trajectory (20% weight)',
    body: 'The current rate and quality of revenue growth. Faster, more consistent, more durable growth = higher score. Distinguishes companies that are actually scaling from those telling a good story.'
  },
  'edge': {
    title: 'Edge & Moat (15% weight)',
    body: 'Whether the company has a real competitive advantage forming — proprietary tech, network effects, switching costs, brand, or distribution lock-in. For early companies the moat is usually being built, not finished.'
  },
  'capital': {
    title: 'Capital Efficiency (15% weight)',
    body: 'How well the company manages cash. High score = profitable or close to it, doesn\'t need to keep raising money. Low score = burning cash and dependent on capital markets staying open.'
  },
  'asymmetry': {
    title: 'Asymmetry Setup (15% weight)',
    body: 'The shape of the payoff. A high score means a small chance of a huge return (5–10×) versus a known limited downside. The whole point of the watch sleeve is finding asymmetric setups, not just good companies.'
  },
  'valuation-watch': {
    title: 'Valuation Reasonableness (15% weight)',
    body: 'Whether the price is defensible given the growth and TAM. Even an asymmetric setup gets ruined by overpaying. Uses sector-appropriate benchmarks — a uranium miner is not judged like a SaaS company.'
  },

  // =========================================================
  // CORE METRICS
  // =========================================================
  'roic': {
    title: 'ROIC — Return on Invested Capital',
    body: 'How much profit a company makes per dollar invested in the business. ROIC of 30% means every $1 of capital generates 30¢ of operating profit each year. Higher is better — Nvidia at ~94% is exceptional, most businesses live around 10–15%.'
  },
  'wacc': {
    title: 'WACC — Weighted Average Cost of Capital',
    body: 'The blended rate the company pays to borrow money plus the return shareholders demand. It\'s the hurdle rate — anything earned above WACC creates value for owners, anything below destroys value.'
  },
  'spread': {
    title: 'ROIC – WACC Spread',
    body: 'The difference between what the business earns on its capital and what that capital costs. A +25% spread means the company creates significant value every year. A negative spread means the business is destroying value, even if it looks profitable on paper.'
  },
  'fcf': {
    title: 'FCF — Free Cash Flow',
    body: 'The actual cash a business generates after paying for everything it needs to keep running and growing. This is the cash that can be returned to shareholders, used for acquisitions, or invested in new products. More reliable than reported earnings.'
  },
  'fcfy': {
    title: 'FCF Yield',
    body: 'Free cash flow as a percentage of the company\'s market cap. A 5% FCF yield means for every $100 of stock, the company produces $5 of real cash per year. Higher = cheaper relative to cash production.'
  },
  'peg': {
    title: 'PEG Ratio',
    body: 'Price-to-Earnings divided by expected growth rate. PEG of 1.0 means you\'re paying fair value for the growth you\'re getting. Below 1 = potentially cheap, above 2 = expensive, above 3 = the growth has to be perfect to justify the price.'
  },
  'pe': {
    title: 'P/E — Price-to-Earnings Ratio',
    body: 'How many years of current earnings you\'re paying for the stock. P/E of 25 means it would take 25 years of today\'s earnings to recoup the price. Useful but incomplete — a P/E of 30 on a fast grower can be cheaper than a P/E of 10 on a shrinking business.'
  },
  'ev': {
    title: 'EV — Enterprise Value',
    body: 'The full price to buy the entire business — market cap plus debt minus cash. More accurate than market cap alone because it accounts for the balance sheet. A company with lots of debt has a higher EV than its stock price suggests.'
  },
  'evrev': {
    title: 'EV/Revenue',
    body: 'Enterprise value divided by annual revenue. Common for fast-growing companies that aren\'t profitable yet. EV/Rev of 10× means you\'re paying $10 for every $1 of yearly sales — only worth it if growth and margins justify.'
  },
  'evrevgrowth': {
    title: 'EV/Revenue ÷ Growth Rate',
    body: 'Adjusts EV/Revenue for how fast the company is growing. A score below 0.5 is genuinely cheap relative to growth; above 1.0 is expensive. Helps separate "expensive but justified" from "expensive and overpriced".'
  },
  'tam': {
    title: 'TAM — Total Addressable Market',
    body: 'The total annual revenue available if the company captured 100% of its market. A $100B TAM with $1B current revenue means lots of room to grow. Always somewhat aspirational — treat as upper bound, not a target.'
  },
  'gm': {
    title: 'Gross Margin',
    body: 'Revenue minus the direct cost of producing the product, expressed as a percentage. Software companies often have 70–85% gross margins (cheap to copy bits); hardware and retail run 20–40% (raw materials cost real money). Higher = more flexibility to invest in growth.'
  },
  'gt': {
    title: 'Gross Margin Trajectory',
    body: 'Whether gross margin is rising, flat, or falling. Rising is great — pricing power or scale economics kicking in. Falling is a warning sign — competition or input costs eating into the business.'
  },
  'moat': {
    title: 'Moat',
    body: 'A combined score from four sources of durable advantage: brand, switching costs, network effects, and scale/distribution. Inspired by Buffett — what keeps competitors from stealing your customers? Higher score = harder to dislodge.'
  },
  'vintage': {
    title: 'Vintage Adjustment',
    body: 'Penalizes companies that only recently became excellent. A company with 5 years of high quality gets a 0.55× multiplier; 20+ years gets 1.0×. Reason: brand-new excellence might not last. Helps avoid mistaking lucky moments for durable franchises.'
  },
  'gap': {
    title: 'Market Gap',
    body: 'The difference between the growth the stock price implies and the growth the company is actually delivering. Positive gap = market underpaying for what\'s happening; negative = price requires more growth than is realistic. Calculated from P/E vs. forward earnings/FCF growth.'
  },
  'cc': {
    title: 'Capital Concentration',
    body: 'Penalty for relying too heavily on one customer or supplier. A company where 40% of revenue comes from one buyer carries hidden risk — if that buyer leaves, the business model breaks.'
  },
  'reg-score': {
    title: 'Regulatory Score',
    body: 'Higher = lower regulatory risk. Captures antitrust exposure, geopolitical risk (e.g., Taiwan/China), data-privacy lawsuits, and government dependencies. Even a perfect business gets discounted if a regulator can break it apart.'
  },
  'composite': {
    title: 'Composite Score',
    body: 'The final 0–10 weighted score combining all pillars. The single number to compare across the universe. But always check the pillar breakdown — two companies with the same composite can have very different shapes.'
  },
  'netret': {
    title: 'Net Retention',
    body: 'For SaaS: of last year\'s customers, what percentage of revenue do they still pay this year (including upgrades, minus cancellations). 100% = customers staying flat; 120% = existing customers spend 20% more each year. A reliable signal of durable growth.'
  },

  // =========================================================
  // VERDICTS — CORE
  // =========================================================
  'verdict-strong': {
    title: 'Strong (Verdict)',
    body: 'Composite ≥ 7.0. Top tier — the framework sees this as a high-quality compounder at a reasonable price. Still not a buy recommendation; do your own work.'
  },
  'verdict-solid': {
    title: 'Solid (Verdict)',
    body: 'Composite 6.0–6.9. Real quality with one or two issues. Often the most interesting hunting ground — good businesses with a question mark.'
  },
  'verdict-watch': {
    title: 'Watch (Verdict)',
    body: 'Composite 5.0–5.9. Decent business but the price or one of the pillars raises concerns. Worth tracking, not necessarily buying yet.'
  },
  'verdict-risk': {
    title: 'Elevated Risk (Verdict)',
    body: 'Composite 4.0–4.9. Either the quality, the price, or external factors are pushing this into risky territory. Below most reasonable thresholds.'
  },
  'verdict-speculative': {
    title: 'Speculative (Verdict)',
    body: 'Composite under 4.0. The framework flags significant problems. Not a value pick — a value trap candidate.'
  },
  'verdict-treasury': {
    title: 'Treasury Vehicle (Verdict)',
    body: 'Special category for companies that don\'t operate as traditional businesses (e.g., MicroStrategy as a Bitcoin treasury). Standard pillars don\'t apply — judge on the underlying asset thesis.'
  },

  // =========================================================
  // VERDICTS — WATCH
  // =========================================================
  'verdict-conviction': {
    title: 'Conviction Bet (Verdict)',
    body: 'Composite ≥ 8.0. Highest-confidence asymmetric setup the framework finds. Strong on multiple pillars at once — market, growth, edge, and price all aligned.'
  },
  'verdict-watch-pos': {
    title: 'Watch Position (Verdict)',
    body: 'Composite 6.5–7.9. Real opportunity but with a meaningful concern — pricing, execution risk, or pillar weakness. Worth a small position with a clear thesis.'
  },
  'verdict-early': {
    title: 'Early Stage (Verdict)',
    body: 'Composite 5.0–6.4. Genuine asymmetric upside but earlier in the journey — less proof, more risk. Size accordingly.'
  },
  'verdict-lottery': {
    title: 'Lottery Ticket (Verdict)',
    body: 'Composite under 5.0. Massive potential upside but real chance of zero. Pre-revenue biotechs, pre-product companies. Size very small or skip.'
  },

  // =========================================================
  // VINTAGE TIERS
  // =========================================================
  'vint-aged': {
    title: 'Vintage — Aged',
    body: '20+ years of consistent quality. The framework gives full credit (1.0× multiplier). Buffett\'s territory — businesses whose moats have been tested through multiple cycles.'
  },
  'vint-mature': {
    title: 'Vintage — Mature',
    body: '10–20 years of high quality (0.85× multiplier). Solid track record but the modern era of dominance is shorter than the truly aged names.'
  },
  'vint-young': {
    title: 'Vintage — Young',
    body: '5–10 years of demonstrated quality (0.70× multiplier). Recent enough that the framework discounts the score — needs more time to prove durability.'
  },
  'vint-fresh': {
    title: 'Vintage — Fresh',
    body: 'Under 5 years of high quality (0.55× multiplier). Heavy penalty — could be a lasting franchise or a recent fluke. The discount forces you to wait for confirmation.'
  },

  // =========================================================
  // CONFIDENCE
  // =========================================================
  'conf-high': {
    title: 'High Confidence',
    body: 'Score backed by recent verified financials (Q4 2025 / Q1 2026). The numbers behind the pillars come from reported filings and consensus estimates.'
  },
  'conf-medium': {
    title: 'Medium Confidence',
    body: 'Recent data with some category-based estimation. Most numbers verified, a few inferred from sector benchmarks.'
  },
  'conf-low': {
    title: 'Low Confidence',
    body: 'Score relies meaningfully on category benchmarks, not company-specific verified data. Treat as a starting point for your own research, not a verdict.'
  },

  // =========================================================
  // OTHER
  // =========================================================
  'upside': {
    title: 'Upside Estimate',
    body: 'Rough multiple range (e.g., 3–7×) from market expansion + asymmetry, adjusted by valuation discipline. Aspirational, not a price target — assumes the bull thesis plays out.'
  },
  'correlation': {
    title: 'Correlation Profile',
    body: 'Which macro forces drive this stock\'s price (tech sentiment, commodity cycles, biotech readouts, etc.). The framework tags candidates so you can build a sleeve that doesn\'t collapse together when one factor turns.'
  },
  'pillar-weights': {
    title: 'Pillar Weights',
    body: 'How much each pillar contributes to the composite score. The weights reflect what matters most for the framework\'s goal — Core leans on Quality (30%) for compounders, Watch spreads weight more evenly across asymmetric pillars.'
  },

  // =========================================================
  // THESIS & RESEARCH FRAMING
  // =========================================================
  'bull-thesis': {
    title: 'Bull Thesis',
    body: 'The case for ownership — what has to be true for the position to compound. Concrete and falsifiable, with specific numbers. A bull thesis you cannot disprove is not a thesis, it is a hope.'
  },
  'bear-thesis': {
    title: 'Bear Thesis',
    body: 'The case against — what would make this position fail. Reading this honestly is harder than building the bull case. If you cannot articulate why a smart person would short this stock, you do not understand it well enough to own it.'
  },
  'thesis-line': {
    title: 'Investment Thesis',
    body: 'A one-line summary of why this name belongs on the watchlist — the structural reason it could compound from here, before getting into the per-pillar detail.'
  },
};
