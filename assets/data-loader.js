// The Compendium — async data loader
// Fetches /data/*.json with graceful fallback. Used by new pages (macro, allocation).
// Existing pages (five-pillar-scorer, watch-opportunity-ledger) keep their inline
// data for now and will be migrated in Phase 2.
(function () {
  const CACHE_KEY_PREFIX = 'compendium_cache_';
  const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — prices refresh daily but we don't want to thrash

  async function loadJson(path, { useCache = true } = {}) {
    const cacheKey = CACHE_KEY_PREFIX + path;
    if (useCache) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.ts && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
        }
      } catch (_) { /* sessionStorage may be disabled — fall through */ }
    }
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
      } catch (_) { /* ignore */ }
      return data;
    } catch (err) {
      console.warn(`[data-loader] ${path} failed:`, err.message);
      return null;
    }
  }

  async function loadAll() {
    const [core, watch, prices, macro, lastUpdated] = await Promise.all([
      loadJson('data/core.json'),
      loadJson('data/watch.json'),
      loadJson('data/prices.json'),
      loadJson('data/macro.json'),
      loadJson('data/last_updated.json'),
    ]);
    return { core, watch, prices, macro, lastUpdated };
  }

  // Merge live price snapshot into a company list. Fields from prices override
  // the embedded snapshot when present. Source-of-record fields (moat, vintage,
  // regulatory, qualitative notes, TAM, thesis, bull/bear) are preserved from
  // the embedded snapshot.
  //
  // Handles both Core schema (pe, peg, fcfY, fwdG) and Watch schema (ev, evRev,
  // growth, revenue). Fields the company doesn't have are simply added as
  // metadata; the existing render code ignores anything it doesn't read.
  function mergeWithPrices(companies, pricesPayload) {
    if (!companies || !pricesPayload || !pricesPayload.rows) return companies;
    const byTicker = Object.fromEntries(pricesPayload.rows.map(r => [r.t, r]));
    return companies.map(c => {
      const live = byTicker[c.t];
      if (!live || live.error || (live.price == null && live.marketCap == null)) {
        return { ...c, _live: false };
      }
      const merged = {
        ...c,
        // CORE-schema volatile fields (no-op on Watch companies that don't have them)
        pe:   c.pe   != null ? (live.pe_forward ?? live.pe_trailing ?? c.pe) : c.pe,
        peg:  c.peg  != null ? (live.peg ?? c.peg) : c.peg,
        gm:   c.gm   != null ? (live.gm ?? c.gm) : c.gm,
        fcfY: c.fcfY != null ? (live.fcfY ?? c.fcfY) : c.fcfY,
        fwdG: c.fwdG != null ? (live.fwdG_eps ?? c.fwdG) : c.fwdG,
        // WATCH-schema volatile fields (no-op on Core companies)
        ev:    c.ev    !== undefined && live.ev != null ? +(live.ev / 1e9).toFixed(2) : c.ev,
        evRev: c.evRev !== undefined ? (live.ev_rev ?? c.evRev) : c.evRev,
        growth: c.growth !== undefined && live.fwdG_rev != null ? Math.round(live.fwdG_rev) : c.growth,
        // recompute EV/Rev/Growth where both values are present
        evRevGrowth: undefined,
        // attach live-only metadata
        _live: true,
        _price: live.price,
        _marketCap: live.marketCap,
        _ev: live.ev,
        _evRev: live.ev_rev,
        _beta: live.beta,
        _52wHigh: live['52wHigh'],
        _52wLow: live['52wLow'],
        _shortPercent: live.shortPercent,
        _asof: live.asof,
      };
      // Restore evRevGrowth — recomputed if both inputs are numeric, else preserved
      if (c.evRevGrowth !== undefined) {
        const ev = merged.evRev;
        const g = merged.growth;
        merged.evRevGrowth = (typeof ev === 'number' && typeof g === 'number' && g > 0)
          ? +(ev / g).toFixed(2)
          : c.evRevGrowth;
      } else {
        delete merged.evRevGrowth;
      }
      return merged;
    });
  }

  window.COMPENDIUM = { loadJson, loadAll, mergeWithPrices };
})();
