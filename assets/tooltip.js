// The Compendium — Tooltip behavior
// Auto-attaches to any element with data-glossary="<key>" using the GLOSSARY map.
(function () {
  function init() {
    if (!window.GLOSSARY) {
      console.warn('[tooltip] glossary.js not loaded yet — retrying');
      setTimeout(init, 50);
      return;
    }

    // Single pooled tooltip element
    let tip = document.getElementById('cmp-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'cmp-tooltip';
      tip.innerHTML = '<div class="tt-title"></div><div class="tt-body"></div>';
      document.body.appendChild(tip);
    }
    const titleEl = tip.querySelector('.tt-title');
    const bodyEl = tip.querySelector('.tt-body');

    let activeEl = null;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    function showFor(el) {
      const key = el.getAttribute('data-glossary');
      if (!key) return;
      const entry = window.GLOSSARY[key];
      if (!entry) {
        console.warn('[tooltip] missing glossary entry for', key);
        return;
      }
      titleEl.textContent = entry.title;
      bodyEl.textContent = entry.body;

      // Position on desktop. Mobile CSS pins to bottom.
      if (window.innerWidth > 600) {
        const rect = el.getBoundingClientRect();
        const tipWidth = 320;
        const margin = 8;
        let left = rect.left + rect.width / 2 - tipWidth / 2;
        if (left < margin) left = margin;
        if (left + tipWidth > window.innerWidth - margin) left = window.innerWidth - tipWidth - margin;
        let top = rect.bottom + 8;
        // Flip above if it would overflow viewport
        if (top + 200 > window.innerHeight) {
          top = rect.top - 8 - tip.offsetHeight;
          if (top < margin) top = margin;
        }
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      }

      tip.classList.add('is-visible');
      el.classList.add('is-active');
      activeEl = el;
    }

    function hide() {
      tip.classList.remove('is-visible');
      if (activeEl) activeEl.classList.remove('is-active');
      activeEl = null;
    }

    function attach(el) {
      if (el.dataset.tooltipBound) return;
      el.dataset.tooltipBound = '1';

      if (isCoarsePointer) {
        // Mobile / touch: tap to toggle
        el.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (activeEl === el) {
            hide();
          } else {
            showFor(el);
          }
        });
      } else {
        // Desktop: hover + click works for keyboard users
        el.addEventListener('mouseenter', function () { showFor(el); });
        el.addEventListener('mouseleave', function () { hide(); });
        el.addEventListener('focus', function () { showFor(el); });
        el.addEventListener('blur', function () { hide(); });
        el.addEventListener('click', function (e) {
          // Allow click on info icon to NOT trigger parent navigation
          e.stopPropagation();
        });
      }
    }

    function scan() {
      document.querySelectorAll('[data-glossary]').forEach(attach);
    }

    // Initial scan
    scan();

    // Observe DOM for dynamically added trigger elements
    const obs = new MutationObserver(function () { scan(); });
    obs.observe(document.body, { childList: true, subtree: true });

    // Outside-click dismisses on mobile
    document.addEventListener('click', function (e) {
      if (!activeEl) return;
      if (e.target === activeEl || activeEl.contains(e.target)) return;
      if (tip.contains(e.target)) return;
      hide();
    });

    // ESC dismisses
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });

    // Scroll dismisses (desktop hover anyway, mobile may want it)
    window.addEventListener('scroll', hide, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
