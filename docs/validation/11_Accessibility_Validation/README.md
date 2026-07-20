# 11 — Accessibility Validation

**Wave:** 2  
**Owner:** Frontend + QA  
**Standard:** WCAG 2.2 AA (target)

## Scope (priority pages)

Login · Super Admin colleges · Assessment Hub dashboard · Drive create · College students · Student exam instructions / player

## Checks

| ID | Check | Status |
|----|-------|--------|
| A11Y-01 | Keyboard-only navigation through login + primary nav | BACKLOG |
| A11Y-02 | Focus visible on interactive controls | BACKLOG |
| A11Y-03 | Form labels / aria for identifier & password | BACKLOG |
| A11Y-04 | Color contrast on navy/slate admin theme | BACKLOG |
| A11Y-05 | Screen reader announces toasts/errors | BACKLOG |
| A11Y-06 | Exam player keyboard operable | BACKLOG |
| A11Y-07 | axe-core CI on Wave 1 routes | BACKLOG |

## Method

Playwright + `@axe-core/playwright` spot suite; manual NVDA/VoiceOver sample.
