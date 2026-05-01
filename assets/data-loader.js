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
  // regulatory, qualitative notes) are preserved from the embedded snapshot.
  function mergeWithPrices(companies, pricesPayload) {
    if (!companies || !pricesPayload || !pricesPayload.rows) return companies;
    const byTicker = Object.fromEntries(pricesPayload.rows.map(r => [r.t, r]));
    return companies.map(c => {
      const live = byTicker[c.t];
      if (!live || live.error) return { ...c, _live: false };
      return {
        ...c,
        // override volatile fields where the live data has a value
        pe:   live.pe_forward ?? live.pe_trailing ?? c.pe,
        peg:  live.peg ?? c.peg,
        gm:   live.gm ?? c.gm,
        fcfY: live.fcfY ?? c.fcfY,
        fwdG: live.fwdG_eps ?? c.fwdG,
        // attach live-only fields
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
    });
  }

  window.COMPENDIUM = { loadJson, loadAll, mergeWithPrices };
})();
