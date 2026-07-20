# 12 — Compatibility & Responsive Validation

**Wave:** 2  
**Owner:** QA

## Browsers

| ID | Browser | Priority | Status |
|----|---------|----------|--------|
| COMP-01 | Chrome (latest) | P0 — Sprint 1A headed Chromium | PARTIAL |
| COMP-02 | Edge (latest) | P1 | BACKLOG |
| COMP-03 | Firefox (latest) | P1 | BACKLOG |
| COMP-04 | Safari (latest macOS/iOS) | P2 | BACKLOG |

## Responsive viewports

| ID | Viewport | Critical flows | Status |
|----|----------|----------------|--------|
| RESP-01 | Desktop 1600×900 | SA + College + Student Path A | PARTIAL |
| RESP-02 | Laptop 1366×768 | Same | BACKLOG |
| RESP-03 | Tablet 768×1024 | Student learn/practice/exam | BACKLOG |
| RESP-04 | Mobile 390×844 | Student login + practice (exam may be desktop-first) | BACKLOG |

## Notes

- Sprint 1A locks viewport 1600×900 — document mobile exam policy with product before FAIL.  
- Host `admin.localhost` vs `localhost` cookie behavior must be consistent in COMP-01.
