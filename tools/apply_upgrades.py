#!/usr/bin/env python3
"""Apply the interactive-upgrade markup to all pages of The Gig Ledger.

Idempotent: skips pages that already have the markup.
"""
import os
import re
import sys

SITE = os.path.expanduser("~/workspace/sites/freelancer-finance")
ARTICLES = [
    "2026-quarterly-tax-deadlines",
    "21-tax-deductions-freelancers-miss",
    "best-invoicing-software-for-freelancers",
    "quarterly-estimated-taxes-explained",
    "sep-ira-vs-solo-401k",
    "the-freelancers-tax-playbook",
    "the-percentage-budget",
]
PAGES = ["index.html", "disclosure.html"] + [f"articles/{a}.html" for a in ARTICLES]

BOOTSTRAP = """<script>
/* Theme bootstrap: apply the saved theme (or prefers-color-scheme) before first paint. */
(function(){try{var t=localStorage.getItem('gigledger-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
</script>"""

SEARCH_FORM = """      <form class="site-search" role="search" onsubmit="return false;">
        <label class="visually-hidden" for="siteSearch">Search articles</label>
        <input id="siteSearch" class="site-search-input" type="search" name="q" placeholder="Search articles\u2026" autocomplete="off" aria-expanded="false" aria-controls="searchResults" role="combobox" aria-autocomplete="list">
        <div class="site-search-results" id="searchResults" role="listbox" hidden></div>
      </form>"""

TOGGLE_RE = re.compile(
    r'<button class="nav-toggle" id="navToggle" aria-expanded="false" '
    r'aria-controls="siteNav" aria-label="Toggle navigation">\u2630</button>'
    r'\s*(<nav class="site-nav" id="siteNav" aria-label="Primary">.*?</nav>)',
    re.DOTALL,
)
NAVLIST_RE = re.compile(r"(      </ul>)\n    </nav>")
INLINE_SCRIPT_RE = re.compile(r"\n<script>\n\(function \(\) \{\n.*?\n\}\)\(\);\n</script>\n\n</body>", re.DOTALL)


def main():
    for page in PAGES:
        path = os.path.join(SITE, page)
        with open(path, encoding="utf-8") as f:
            html = f.read()
        original = html

        is_article = page.startswith("articles/")
        css_href = "../styles.css" if is_article else "styles.css"
        js_src = "../assets/site.js" if is_article else "assets/site.js"

        # 1. Head: theme bootstrap + shared site.js (replaces per-page inline nav script).
        if 'id="themeToggle"' in html or 'assets/site.js' in html:
            pass  # already applied
        else:
            anchor = f'<link rel="stylesheet" href="{css_href}">'
            assert anchor in html, f"stylesheet link not found in {page}"
            html = html.replace(
                anchor,
                anchor + "\n" + BOOTSTRAP + f'\n<script src="{js_src}" defer></script>',
                1,
            )

            # 2. Search form at the end of the nav.
            html, n = NAVLIST_RE.subn(lambda m: m.group(1) + "\n" + SEARCH_FORM + "\n    </nav>", html, count=1)
            assert n == 1, f"nav list end not found in {page}"

            # 3. Header buttons: theme toggle + mobile nav toggle, nav moved first.
            toggle_html = (
                '<button class="nav-toggle" id="navToggle" aria-expanded="false" '
                'aria-controls="siteNav" aria-label="Toggle navigation">\u2630</button>'
            )
            theme_btn = (
                '<button class="theme-toggle" id="themeToggle" type="button" '
                'aria-pressed="false" aria-label="Switch to dark mode">'
                '<span class="theme-icon" aria-hidden="true">\u263e</span></button>'
            )
            def restructure(m):
                nav = m.group(1)
                return (
                    nav + "\n"
                    "    <div class=\"header-buttons\">\n"
                    f"      {theme_btn}\n"
                    f"      {toggle_html}\n"
                    "    </div>"
                )
            html, n = TOGGLE_RE.subn(restructure, html, count=1)
            assert n == 1, f"header restructure failed in {page}"

            # 4. Remove the old inline nav-toggle script (now in site.js).
            html, n = INLINE_SCRIPT_RE.subn("\n</body>", html, count=1)
            assert n == 1, f"inline script not found in {page}"

        if html != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"updated {page}")
        else:
            print(f"skipped {page} (already applied)")


if __name__ == "__main__":
    sys.exit(main())
