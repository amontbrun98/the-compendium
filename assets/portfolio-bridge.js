// The Compendium — portfolio bridge
// Auto-injects "+" buttons next to every ticker on Five Pillar and Watch pages.
// Click adds the ticker to the localStorage portfolio used by allocation.html,
// runs cluster/sleeve saturation checks, and shows a toast with results.
(function () {
  const STORAGE_KEY = 'compendium_positions_v1';
  const RULES = {
    per_name_core: 0.08, per_name_watch: 0.03,
    per_cluster_core: 0.25, per_cluster_watch: 0.12,
    watch_total: 0.20,
  };

  let universe = {};   // ticker -> { n, cluster, sleeve_default }
  let universeLoaded = false;

  // -------- storage --------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"cash":50000,"positions":[]}'); }
    catch (_) { return { cash: 0, positions: [] }; }
  }
  function save(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  function newId() { return Math.random().toString(36).slice(2, 9); }

  // -------- universe lookup --------
  async function loadUniverse() {
    if (universeLoaded) return universe;
    try {
      const [core, watch] = await Promise.all([
        fetch('data/core.json').then(r => r.json()).catch(() => []),
        fetch('data/watch.json').then(r => r.json()).catch(() => []),
      ]);
      (core || []).forEach(c => { universe[c.t] = { n: c.n, cluster: c.cluster, sleeve: 'core' }; });
      (watch || []).forEach(c => { universe[c.t] = { n: c.n, cluster: c.cluster, sleeve: 'watch' }; });
      universeLoaded = true;
    } catch (_) { /* offline — universe lookup will return undefined */ }
    return universe;
  }

  // -------- math --------
  function pageSleeve() {
    const path = location.pathname.toLowerCase();
    if (path.includes('watch')) return 'watch';
    if (path.includes('five-pillar') || path.includes('core')) return 'core';
    return 'core';
  }

  function magShort(n) {
    if (!n || isNaN(n)) return '$0';
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (a >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
  }

  function defaultDollarsFor(sleeve, currentTotal) {
    if (currentTotal <= 0) return sleeve === 'watch' ? 1500 : 5000;
    const cap = sleeve === 'watch' ? RULES.per_name_watch : RULES.per_name_core;
    return Math.round(cap * currentTotal);
  }

  // -------- saturation check --------
  function analyzePortfolio(state) {
    const total = (state.cash || 0) + state.positions.reduce((s, p) => s + (p.dollars || 0), 0);
    const clusters = {};
    state.positions.forEach(p => {
      const m = universe[p.t] || { cluster: 'unclassified' };
      const key = p.sleeve + '::' + m.cluster;
      clusters[key] = clusters[key] || { sleeve: p.sleeve, cluster: m.cluster, dollars: 0, names: [] };
      clusters[key].dollars += (p.dollars || 0);
      clusters[key].names.push(p.t);
    });
    const watchTotal = state.positions.filter(p => p.sleeve === 'watch').reduce((s, p) => s + p.dollars, 0);
    const breaches = [];
    state.positions.forEach(p => {
      const cap = p.sleeve === 'core' ? RULES.per_name_core : RULES.per_name_watch;
      if (total > 0 && p.dollars / total > cap) {
        breaches.push({ kind: 'name', t: p.t, pct: p.dollars/total*100, cap: cap*100, trim: Math.round(p.dollars - cap*total) });
      }
    });
    Object.values(clusters).forEach(c => {
      const cap = c.sleeve === 'core' ? RULES.per_cluster_core : RULES.per_cluster_watch;
      if (total > 0 && c.dollars / total > cap) {
        breaches.push({ kind: 'cluster', cluster: c.cluster, sleeve: c.sleeve, pct: c.dollars/total*100, cap: cap*100, names: c.names });
      }
    });
    if (total > 0 && watchTotal/total > RULES.watch_total) {
      breaches.push({ kind: 'sleeve', sleeve: 'watch', pct: watchTotal/total*100, cap: RULES.watch_total*100, trim: Math.round(watchTotal - RULES.watch_total*total) });
    }
    return { total, clusters, watchTotal, breaches };
  }

  // -------- core action --------
  async function addToPortfolio(ticker, sleeveHint) {
    await loadUniverse();
    const state = load();
    const meta = universe[ticker];
    const sleeve = sleeveHint || (meta && meta.sleeve) || 'core';

    const existing = state.positions.find(p => p.t === ticker);
    const currentTotal = (state.cash || 0) + state.positions.reduce((s, p) => s + p.dollars, 0);
    const suggested = defaultDollarsFor(sleeve, currentTotal);

    const promptMsg = existing
      ? `${ticker} is already in your portfolio at ${magShort(existing.dollars)}.\n\nEnter NEW dollar amount (replaces current), or cancel:`
      : `Add ${ticker} to your portfolio.\n\nDollar amount?\n\nSuggested: ${magShort(suggested)} (per-name cap of ${(sleeve==='watch'?3:8)}% × current total)`;
    const raw = prompt(promptMsg, suggested);
    if (raw === null) return;
    const dollars = parseFloat(raw);
    if (!dollars || dollars <= 0) { showToast('Invalid amount — cancelled.', 'warn'); return; }

    if (existing) {
      existing.dollars = dollars;
      existing.sleeve = sleeve;
    } else {
      state.positions.push({ id: newId(), t: ticker, sleeve, dollars, note: 'added from ledger' });
    }
    save(state);

    const a = analyzePortfolio(state);
    const breachesForThis = a.breaches.filter(b =>
      (b.kind === 'name' && b.t === ticker) ||
      (b.kind === 'cluster' && (universe[ticker] || {}).cluster === b.cluster) ||
      (b.kind === 'sleeve' && b.sleeve === sleeve)
    );

    if (breachesForThis.length === 0) {
      showToast(`✓ Added ${ticker} at ${magShort(dollars)}. Portfolio total: ${magShort(a.total)}.`, 'ok');
    } else {
      const lines = breachesForThis.map(b => {
        if (b.kind === 'name') return `${b.t} now ${b.pct.toFixed(1)}% — over ${b.cap.toFixed(0)}% cap. Trim ${magShort(b.trim)}.`;
        if (b.kind === 'cluster') return `Cluster "${b.cluster}" now ${b.pct.toFixed(1)}% — over ${b.cap.toFixed(0)}% cap. Names: ${b.names.join(', ')}.`;
        if (b.kind === 'sleeve') return `${b.sleeve} sleeve now ${b.pct.toFixed(1)}% — over ${b.cap.toFixed(0)}% cap. Trim ${magShort(b.trim)}.`;
      });
      showToast(`Added ${ticker} at ${magShort(dollars)}. <strong>${breachesForThis.length} cap breach${breachesForThis.length===1?'':'es'}:</strong><br>${lines.join('<br>')}`, 'warn', 8000);
    }

    refreshAllButtons();
  }

  function isInPortfolio(ticker) {
    const state = load();
    return state.positions.some(p => p.t === ticker);
  }

  // -------- DOM --------
  function styleButton(btn, inPortfolio) {
    btn.style.cssText = `
      background: ${inPortfolio ? 'rgba(109,184,61,.1)' : 'transparent'};
      color: ${inPortfolio ? 'var(--bull, #6db83d)' : 'var(--accent, #e85d3d)'};
      border: 1px solid ${inPortfolio ? 'var(--bull, #6db83d)' : 'var(--accent, #e85d3d)'};
      padding: 2px 8px;
      margin-left: 8px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 2px;
      transition: all .15s ease;
      vertical-align: middle;
      line-height: 1.4;
    `;
    btn.textContent = inPortfolio ? '✓ in port' : '+ add';
  }

  function injectButtons() {
    const sleeve = pageSleeve();
    document.querySelectorAll('.co-ticker').forEach(el => {
      // skip if button already injected
      if (el.parentElement && el.parentElement.querySelector('.add-to-port-btn')) return;
      const ticker = (el.textContent || '').trim().split(/\s+/)[0];
      if (!ticker || !/^[A-Z][A-Z0-9.\-]{0,7}$/.test(ticker)) return;
      const btn = document.createElement('button');
      btn.className = 'add-to-port-btn';
      btn.dataset.ticker = ticker;
      styleButton(btn, isInPortfolio(ticker));
      btn.onclick = e => { e.stopPropagation(); e.preventDefault(); addToPortfolio(ticker, sleeve); };
      btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; };
      btn.onmouseout  = () => { btn.style.transform = 'scale(1)'; };
      el.parentElement.appendChild(btn);
    });
  }

  function refreshAllButtons() {
    document.querySelectorAll('.add-to-port-btn').forEach(btn => {
      styleButton(btn, isInPortfolio(btn.dataset.ticker));
    });
  }

  // -------- toast --------
  function showToast(html, level = 'ok', ms = 4500) {
    let host = document.getElementById('compendium-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'compendium-toast-host';
      host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;flex-direction:column;gap:10px;max-width:420px;';
      document.body.appendChild(host);
    }
    const colors = {
      ok:   { bg: 'rgba(45,80,22,.95)',  border: '#6db83d', text: '#f0ebe2' },
      warn: { bg: 'rgba(184,39,13,.95)', border: '#e85d3d', text: '#f0ebe2' },
      info: { bg: 'rgba(28,26,23,.95)',  border: '#c4bdb0', text: '#f0ebe2' },
    };
    const c = colors[level] || colors.info;
    const t = document.createElement('div');
    t.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:14px 18px;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.6;border-radius:3px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:compFadeIn .25s ease;`;
    t.innerHTML = html + ` <a href="allocation.html" style="display:inline-block;margin-top:8px;color:${c.text};text-decoration:underline;font-size:11px;">→ open allocation engine</a>`;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms);
  }

  // -------- init --------
  function init() {
    loadUniverse().then(injectButtons);
    // Re-scan periodically in case the table re-renders (filters, sorts)
    setInterval(injectButtons, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PORTFOLIO_BRIDGE = { addToPortfolio, isInPortfolio, injectButtons, analyzePortfolio };
})();

// keyframes for toast fade
(function () {
  const s = document.createElement('style');
  s.textContent = '@keyframes compFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }';
  document.head.appendChild(s);
})();
