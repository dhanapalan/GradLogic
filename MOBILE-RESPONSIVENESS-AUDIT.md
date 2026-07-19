# Mobile Responsiveness Audit: Student Learning & Exam Features

**Status**: 🟡 PARTIAL — Learning good, Exam needs fixes  
**Date**: 2026-07-19  
**Target Viewports**: Mobile (375px), Tablet (768px), Desktop (1280px)

---

## Executive Summary

The **Learning module player** is mobile-responsive (uses `grid grid-cols-1 lg:grid-cols-3`), but the **Exam player** has critical mobile issues:

- ❌ **ExamPlayerPage**: Fixed 280px sidebar breaks on mobile screens
- ❌ **Question grid**: `grid-cols-5` creates tiny buttons on phone (< 50px width)
- ❌ **Video proctoring PIP**: Aspect-video fills sidebar, no mobile fallback
- ✅ **ModulePlayerPage**: Already responsive (column grid adapts)
- ✅ **Submitted state**: Mobile-friendly card layout

---

## Detailed Audit

### 1. ExamPlayerPage ❌ CRITICAL

**File**: `client/src/pages/student/ExamPlayerPage.tsx`

#### Issues Found

| Issue | Line | Impact | Severity |
|-------|------|--------|----------|
| Fixed 280px sidebar | 470 | Sidebar wider than mobile screen | 🔴 CRITICAL |
| 5-column question grid | 488 | Buttons too small on mobile | 🔴 CRITICAL |
| No mobile nav toggle | 468 | Sidebar always open, content hidden | 🔴 CRITICAL |
| Fixed top bar height (56px) | 575 | May not fit controls on small screens | 🟡 MEDIUM |
| Proctoring video PIP no fallback | 551 | Aspect-video + 280px = vertical overflow | 🔴 CRITICAL |

#### Current Layout (Desktop Only)
```
┌─────────────────────────────────────────────────────────────┐
│ [SIDEBAR 280px]           [MAIN CONTENT]                    │
│ ├─ Title                  ├─ Timer + Submit                 │
│ ├─ Questions (5×N grid)   ├─ Question Text                  │
│ ├─ Legend                 ├─ Answer Options                 │
│ └─ Proctoring Video PIP   ├─ Prev/Next                      │
│                           └─ Flag/Clear                     │
└─────────────────────────────────────────────────────────────┘
```

**Problem on Mobile (375px)**:
```
Sidebar (280px) + Content (~95px) = Total > 375px ❌
Buttons (10px × 5 = 50px + gaps) = Impossible to tap ❌
```

---

### 2. ModulePlayerPage ✅ GOOD

**File**: `client/src/pages/student/ModulePlayerPage.tsx`

#### What Works
- ✅ Responsive grid: `grid-cols-1 lg:grid-cols-3`
- ✅ Mobile-first design (single column default)
- ✅ Breakpoint at `lg:` (1024px) ensures tablet support
- ✅ Navigation buttons responsive (flex, not fixed width)
- ✅ Score input mobile-friendly
- ✅ LessonContentRenderer handles video scaling

#### Current Layout (Mobile-First)
```
Mobile (375px):
┌─────────────────────────────────────────────┐
│ Top Nav (responsive)                        │
├─────────────────────────────────────────────┤
│ [MAIN CONTENT]                              │
│ ├─ Module header                            │
│ ├─ Video/Content player (responsive)        │
│ ├─ Score input                              │
│ └─ Complete button                          │
├─────────────────────────────────────────────┤
│ [SIDEBAR (col-span-1 at mobile)]            │
│ ├─ Learning path                            │
│ └─ Progress                                 │
└─────────────────────────────────────────────┘
```

---

### 3. Other Student Pages

| Page | Mobile | Status |
|------|--------|--------|
| QuestionBankPage | ? | Not audited |
| PracticePage | ? | Not audited |
| ResultsAnalysisPage | ? | Not audited |
| StudentPortalPage | ? | Not audited |

---

## Mobile Fix: ExamPlayerPage

### Solution: Responsive Sidebar with Toggle

**Strategy**:
1. Hide sidebar on mobile (< 768px)
2. Add toggle button to show/hide sidebar
3. Adjust question grid to `grid-cols-4` on tablet, `grid-cols-5` on desktop
4. Move proctoring video below exam content on mobile
5. Use mobile-optimized timer display

### Implementation

#### Change 1: Add Mobile Hook
```typescript
const isMobile = window.innerWidth < 768;
const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
```

#### Change 2: Conditional Sidebar Rendering
```jsx
{/* Sidebar — hidden on mobile, collapsible via button */}
{(sidebarOpen || !isMobile) && (
  <div className="hidden md:flex w-full md:w-[280px] bg-white border-r border-gray-200 flex-col z-10 relative">
    {/* ... existing sidebar content ... */}
  </div>
)}

{/* Mobile overlay when sidebar open */}
{sidebarOpen && isMobile && (
  <div className="fixed inset-0 bg-black/30 z-5" onClick={() => setSidebarOpen(false)} />
)}
```

#### Change 3: Responsive Question Grid
```jsx
<div className={`grid ${
  isMobile ? 'grid-cols-4 gap-1.5' : 
  isTablet ? 'grid-cols-5 gap-2' : 
  'grid-cols-6 gap-2'
}`}>
```

#### Change 4: Mobile Layout Structure
```jsx
<div className={`flex h-screen ${isMobile ? 'flex-col' : 'flex-row'} bg-gray-50 overflow-hidden`}>
  {/* Sidebar - hidden on mobile unless toggled */}
  
  {/* Main content */}
  <div className="flex-1 flex flex-col min-w-0">
    {/* Top bar with mobile toggle */}
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {isMobile && (
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          ☰
        </button>
      )}
      {/* ... rest of top bar ... */}
    </div>
    
    {/* Question area */}
    {/* Proctoring video - moved to bottom on mobile */}
  </div>
</div>
```

---

## Testing Strategy

### Mobile Viewports
Run these tests to verify mobile support:

```bash
# Exam Player - Mobile
npx playwright test --grep "student.*exam" --headed \
  --viewport 375x812 \
  --args="--disable-device-emulation"

# Exam Player - Tablet
npx playwright test --grep "student.*exam" --headed \
  --viewport 768x1024

# Learning Module - Mobile
npx playwright test --grep "student.*learn" --headed \
  --viewport 375x812
```

### Manual Checklist

#### Mobile (375px)
- [ ] Sidebar hidden by default, toggleable
- [ ] Question grid buttons > 44px (Apple HIG minimum)
- [ ] Timer and submit button readable
- [ ] Answer options stack vertically
- [ ] Proctoring video moves below content
- [ ] Navigation buttons (prev/next) accessible
- [ ] No horizontal scroll

#### Tablet (768px)
- [ ] Sidebar visible in split view
- [ ] Question grid 5 columns fits
- [ ] Proctoring video visible in sidebar
- [ ] All buttons easily tappable

#### Desktop (1280px)
- [ ] Original layout preserved
- [ ] No regression

---

## Prioritization

### Phase 1 (CRITICAL - Do Now)
1. ✅ Hide sidebar on mobile
2. ✅ Add sidebar toggle button
3. ✅ Fix question grid for small screens
4. ✅ Move proctoring video on mobile

### Phase 2 (Should Do - Next Sprint)
1. Add swipe navigation for questions
2. Optimize timer display for small screens
3. Test with real mobile devices
4. Add touch-friendly flags/clear buttons

### Phase 3 (Nice to Have - Later)
1. Dark mode for low-light testing
2. Landscape orientation support
3. Custom mobile exam UI with full-screen options
4. Voice answer selection (accessibility)

---

## Code Changes Required

### Files to Modify
1. `client/src/pages/student/ExamPlayerPage.tsx` — Main fix
2. `client/src/pages/student/PracticePage.tsx` — Similar sidebar
3. `client/tests/e2e/sprint-1a/specs/flow-5-6.spec.ts` — Add mobile tests

### Estimated Effort
- **ExamPlayerPage**: 1-2 hours (responsive logic + testing)
- **PracticePage**: 30 min (similar pattern)
- **Mobile tests**: 1 hour (add viewport tests)
- **Manual verification**: 30 min

---

## Success Criteria

✅ **ExamPlayerPage**
- No horizontal scroll on 375px viewport
- Question buttons ≥ 44px × 44px on mobile
- Sidebar toggleable on mobile
- All controls accessible without zoom

✅ **ModulePlayerPage**
- Already passes (no changes needed)

✅ **Tests**
- All flow specs pass on 375px and 768px viewports
- No layout regressions on desktop

---

## Implementation Priority

**Start with ExamPlayerPage changes** since exam-taking is the most critical student workflow. Learning modules are already responsive and can be fine-tuned later.

Estimated timeline: **2-3 hours total** for complete mobile support.

---

## References

- [Apple Human Interface Guidelines - Touch](https://developer.apple.com/design/human-interface-guidelines/inputs/touch/)
- [Material Design - Touch Targets](https://m3.material.io/foundations/interaction/states)
- [Responsive Web Design Best Practices](https://web.dev/responsive-web-design-basics/)

---

**Next Step**: Implement ExamPlayerPage mobile fixes and run mobile viewport tests.
