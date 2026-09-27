/* The Gig Ledger — shared site scripts (vanilla JS).
 * Features: mobile nav, dark mode, site search, article TOC + scroll-spy,
 * reading progress, sortable tables, FAQ accordions, back-to-top.
 * Everything degrades gracefully when JS is unavailable. */
(function () {
  'use strict';

  /* ---------- Mobile nav toggle ---------- */
  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- Dark mode ---------- */
  var THEME_KEY = 'gigledger-theme';
  function applyTheme(theme, btn) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
    if (btn) {
      var dark = theme === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      var icon = btn.querySelector('.theme-icon');
      if (icon) icon.textContent = dark ? '☀' : '☾';
    }
  }
  function initTheme() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    // The <head> bootstrap script already set data-theme from localStorage
    // or prefers-color-scheme; sync the button to it.
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current, btn);
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, btn);
    });
  }

  /* ---------- Site search ---------- */
  function initSearch() {
    var input = document.getElementById('siteSearch');
    var box = document.getElementById('searchResults');
    if (!input || !box) return;
    var inArticles = /(^|\/)articles\//.test(window.location.pathname);
    var indexUrl = (inArticles ? '../' : '') + 'search-index.json';
    var entries = null;
    var items = [];
    var active = -1;

    function hide() {
      box.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    }
    function show() {
      if (box.children.length) {
        box.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      }
    }
    function resolveUrl(url) {
      // Index stores urls as "articles/<slug>.html".
      return inArticles ? url.replace(/^articles\//, '') : url;
    }
    function highlight(item) {
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('active', i === item);
      }
      active = item;
    }
    function render(q) {
      q = q.trim().toLowerCase();
      box.innerHTML = '';
      items = [];
      if (!q || !entries) { hide(); return; }
      var hits = entries.filter(function (a) {
        var hay = a.title + ' ' + a.excerpt + ' ' + (a.headings || []).join(' ');
        return hay.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 6);
      if (!hits.length) {
        var none = document.createElement('div');
        none.className = 'site-search-empty';
        none.textContent = 'No articles match "' + q.trim() + '".';
        box.appendChild(none);
      } else {
        hits.forEach(function (a) {
          var link = document.createElement('a');
          link.className = 'site-search-item';
          link.setAttribute('role', 'option');
          link.href = resolveUrl(a.url);
          var t = document.createElement('span');
          t.className = 'site-search-title';
          t.textContent = a.title;
          var e = document.createElement('span');
          e.className = 'site-search-excerpt';
          e.textContent = a.excerpt;
          link.appendChild(t);
          link.appendChild(e);
          box.appendChild(link);
          items.push(link);
        });
      }
      show();
    }

    var timer = null;
    input.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { render(input.value); }, 120);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        var next = e.key === 'ArrowDown'
          ? (active + 1) % items.length
          : (active - 1 + items.length) % items.length;
        highlight(next);
        if (items[next]) items[next].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (active >= 0 && items[active]) {
          window.location.href = items[active].href;
        }
      } else if (e.key === 'Escape') {
        hide();
        input.blur();
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-search')) hide();
    });
    input.addEventListener('focus', function () {
      if (input.value.trim() && box.children.length) show();
    });

    fetch(indexUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('index not found');
        return r.json();
      })
      .then(function (data) {
        entries = data.articles || [];
      })
      .catch(function () {
        // Degrade gracefully: search simply becomes unavailable.
        input.disabled = true;
        input.placeholder = 'Search unavailable';
      });
  }

  /* ---------- Table of contents + scroll-spy ---------- */
  function slugify(s) {
    var slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'section';
  }
  function initToc() {
    var article = document.querySelector('.article-page article');
    if (!article) return;
    var headings = Array.prototype.filter.call(
      article.querySelectorAll('h2, h3'),
      function (h) { return !h.closest('.faq, .keep-reading'); }
    );
    if (headings.length < 3) return; // short pages don't need a TOC
    var used = {};
    var toc = document.createElement('nav');
    toc.className = 'toc';
    toc.setAttribute('aria-label', 'In this article');
    var title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = 'In this article';
    var ul = document.createElement('ul');
    var linkById = {};
    headings.forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent);
        var id = base;
        var n = 2;
        while (document.getElementById(id) || used[id]) { id = base + '-' + (n++); }
        used[id] = true;
        h.id = id;
      }
      var li = document.createElement('li');
      li.className = h.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
      linkById[h.id] = a;
    });
    toc.appendChild(title);
    toc.appendChild(ul);
    article.insertBefore(toc, headings[0]);

    if ('IntersectionObserver' in window) {
      var current = null;
      var observer = new IntersectionObserver(function (ioEntries) {
        ioEntries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var link = linkById[entry.target.id];
            if (link && link !== current) {
              if (current) current.classList.remove('active');
              link.classList.add('active');
              current = link;
            }
          }
        });
      }, { rootMargin: '-15% 0px -70% 0px' });
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  /* ---------- Reading progress bar ---------- */
  function initProgress() {
    var article = document.querySelector('.article-page article');
    if (!article) return;
    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    var fill = document.createElement('span');
    bar.appendChild(fill);
    document.body.insertBefore(bar, document.body.firstChild);
    var ticking = false;
    function update() {
      ticking = false;
      var rect = article.getBoundingClientRect();
      var total = article.offsetHeight - window.innerHeight;
      var done = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      fill.style.width = (total > 0 ? (done / total) * 100 : 0) + '%';
    }
    function requestUpdate() {
      if (!ticking) {
        ticking = true;
        if ('requestAnimationFrame' in window) requestAnimationFrame(update);
        else update();
      }
    }
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  /* ---------- Sortable tables ---------- */
  function cellValue(td) {
    var text = ((td.textContent || '').trim()).toLowerCase();
    var match = text.match(/-?\d[\d,.]*/);
    if (match && text.search(/-?\d/) <= 4) {
      return { isNum: true, n: parseFloat(match[0].replace(/,/g, '')), s: text };
    }
    return { isNum: false, n: 0, s: text };
  }
  function initSortableTables() {
    var tables = document.querySelectorAll('.article-page table');
    tables.forEach(function (table) {
      var thead = table.tHead;
      var tbody = table.tBodies[0];
      if (!thead || !thead.rows.length || !tbody) return;
      var ths = thead.rows[0].cells;
      table.classList.add('sortable');
      Array.prototype.forEach.call(ths, function (th, col) {
        var label = (th.textContent || '').trim();
        if (!label) return; // skip empty corner cells
        th.setAttribute('aria-sort', 'none');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-btn';
        btn.setAttribute('aria-label', 'Sort by ' + label);
        var text = document.createElement('span');
        text.textContent = label;
        var arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '⇅';
        btn.appendChild(text);
        btn.appendChild(document.createTextNode(' '));
        btn.appendChild(arrow);
        th.textContent = '';
        th.appendChild(btn);
        var dir = 0; // 1 = ascending, -1 = descending
        btn.addEventListener('click', function () {
          dir = dir === 1 ? -1 : 1;
          Array.prototype.forEach.call(ths, function (other) {
            other.setAttribute('aria-sort', 'none');
          });
          th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
          arrow.textContent = dir === 1 ? '↑' : '↓';
          var rows = Array.prototype.slice.call(tbody.rows);
          rows.sort(function (rowA, rowB) {
            var va = cellValue(rowA.cells[col]);
            var vb = cellValue(rowB.cells[col]);
            var cmp;
            if (va.isNum && vb.isNum) cmp = va.n - vb.n;
            else if (va.isNum) cmp = -1;
            else if (vb.isNum) cmp = 1;
            else cmp = va.s < vb.s ? -1 : (va.s > vb.s ? 1 : 0);
            return cmp * dir;
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        });
      });
    });
  }

  /* ---------- FAQ accordions ----------
   * The markup already uses native <details>/<summary>, which is keyboard
   * accessible. This upgrades them: single-open accordion behavior and
   * aria-expanded syncing on the summary. */
  function initFaq() {
    var items = document.querySelectorAll('.faq details');
    if (!items.length) return;
    items.forEach(function (details) {
      var summary = details.querySelector('summary');
      if (!summary) return;
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
      details.addEventListener('toggle', function () {
        summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
        if (details.open) {
          Array.prototype.forEach.call(
            details.parentElement.querySelectorAll('details'),
            function (other) {
              if (other !== details && other.open) other.open = false;
            }
          );
        }
      });
    });
  }

  /* ---------- Back to top ---------- */
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.textContent = '↑';
    document.body.appendChild(btn);
    function onScroll() {
      btn.classList.toggle('visible', window.scrollY > 600);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', function () {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    });
    onScroll();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initTheme();
    initSearch();
    initToc();
    initProgress();
    initSortableTables();
    initFaq();
    initBackToTop();
  });
})();
