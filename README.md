# test_code_merlin

**CodeMerlin** — single-page landing demo: theme preferences, name capture, greeting, banner, skip-link, and accessibility-focused styling. Stack: static `index.html`, Vitest + jsdom (`npm test`).

## Scope for PR review / automation

This codebase implements **only** the static landing experience. **Do not** evaluate PRs here against commerce/back-office acceptance criteria (**inventory concurrency**, checkout races, payment, ledger, stock holds, Prometheus operational metrics, or runbooks). Those items are **not applicable**; see [`docs/COMMERCE_AC_OUT_OF_SCOPE.md`](docs/COMMERCE_AC_OUT_OF_SCOPE.md).

## UI copy

User-visible Serbian strings are centralized in the `UI_COPY` object in `index.html` (including labels, validation messages, and the character-counter suffix). Static HTML includes matching defaults so the counter and headings remain readable if script execution is delayed.

## README checkpoints (“basara test1” … “basara test5”)

Checkpoint markers below map to Vitest specs under `describe('README: basara test checkpoints')` in `index.test.js`.

| Marker | Intent |
|--------|--------|
| basara test1 | Shell: document title + `#main` landmark |
| basara test2 | Theme toggle updates DOM + persists `theme` in storage |
| basara test3 | Saving a valid name updates the greeting |
| basara test4 | Escape clears the name input |
| basara test5 | Banner close persists `bannerDismissed` |

### Inline markers (search-friendly)

basara test1  
basara test2  
basara test3  
basara test4  
basara test5  
