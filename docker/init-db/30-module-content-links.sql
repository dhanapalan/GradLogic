-- =============================================================================
-- 30-module-content-links.sql
-- Link LMS module groups to real content (courses + question bank) and seed
-- the Aptitude & Reasoning module with publishable course content.
-- Must run AFTER 22-lms-practice-development.sql and 28-lms-module-groups.sql.
-- =============================================================================

-- ── 1. feature_modules.question_categories ──────────────────────────────────
-- Maps a module group to question_bank categories (drives practice + tests).
ALTER TABLE feature_modules
  ADD COLUMN IF NOT EXISTS question_categories JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE feature_modules SET question_categories = '["aptitude","reasoning","maths"]'::jsonb
WHERE key = 'aptitude-reasoning' AND deleted_at IS NULL;

UPDATE feature_modules SET question_categories = '["data_structures","programming","python_coding","java_coding","data_science"]'::jsonb
WHERE key = 'technical-skills' AND deleted_at IS NULL;

-- ── 2. courses.module_key ────────────────────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS module_key VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_courses_module_key ON courses(module_key);

-- Backfill existing courses from their category slug.
UPDATE courses SET module_key = CASE
  WHEN category IN ('aptitude', 'reasoning', 'maths', 'verbal') THEN 'aptitude-reasoning'
  WHEN category IN ('dsa', 'data_structures', 'programming', 'sql') THEN 'technical-skills'
  WHEN category IN ('soft_skills') THEN 'soft-skills-communication'
  ELSE module_key
END
WHERE module_key IS NULL;

-- ── 3. Seed Aptitude & Reasoning courses (idempotent via fixed UUIDs) ────────
-- Course 1: Quantitative Aptitude Foundations
INSERT INTO courses (id, title, description, category, difficulty, duration_hours, status, is_free, tags, total_modules, module_key)
SELECT 'a1000000-0000-4000-8000-000000000001', 'Quantitative Aptitude Foundations',
  'Master percentages, profit & loss, ratios, and time-speed-distance — the four pillars of every campus aptitude test.',
  'aptitude', 'beginner', 8, 'published', TRUE, ARRAY['aptitude','quantitative','campus-prep'], 2, 'aptitude-reasoning'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE id = 'a1000000-0000-4000-8000-000000000001');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a1100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'Numbers & Percentages', 'Percentages, profit & loss, and discount problems with exam shortcuts.', 0, 120
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a1100000-0000-4000-8000-000000000001');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a1100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
  'Ratios, Time & Distance', 'Ratio-proportion and time-speed-distance, the highest-frequency exam topics.', 1, 120
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a1100000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a1110000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001',
  'Percentages — Concepts & Shortcuts', 'text',
E'# Percentages — Concepts & Shortcuts\n\nA percentage is a fraction with denominator 100. Fluency here speeds up profit & loss, interest, and data interpretation.\n\n## Core conversions (memorise)\n\n| Fraction | % | Fraction | % |\n|---|---|---|---|\n| 1/2 | 50% | 1/6 | 16.67% |\n| 1/3 | 33.33% | 1/8 | 12.5% |\n| 1/4 | 25% | 1/12 | 8.33% |\n| 1/5 | 20% | 1/16 | 6.25% |\n\n## Key techniques\n\n**Successive change:** two changes of a% then b% give a net change of `a + b + ab/100`.\nExample: +20% then −10% → 20 − 10 − 2 = **+8%**.\n\n**Reverse percentage:** after a 25% increase the multiplier is 1.25, so to undo it divide by 1.25 (a 20% decrease — not 25%).\n\n**Percentage point vs percent:** moving from 40% to 50% is a rise of 10 percentage points but a 25% relative increase.\n\n## Worked example\n\n> A number increased by 15% gives 460. Find the number.\n\n`N × 1.15 = 460 → N = 400`.\n\n## Practice strategy\n\nSolve 20 questions against the clock in the Practice Arena (topic: *aptitude*). Target: under 45 seconds per question.',
  0, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a1110000-0000-4000-8000-000000000001');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a1110000-0000-4000-8000-000000000002', 'a1100000-0000-4000-8000-000000000001',
  'Profit, Loss & Discount', 'text',
E'# Profit, Loss & Discount\n\nEvery P&L question reduces to three quantities: **Cost Price (CP)**, **Selling Price (SP)**, **Marked Price (MP)**.\n\n## Formulas\n\n- Profit % = (SP − CP)/CP × 100\n- Loss % = (CP − SP)/CP × 100\n- Discount % = (MP − SP)/MP × 100\n- SP = CP × (1 + profit%/100)\n\n## The multiplier method\n\nWrite every change as a multiplier and chain them:\n\n> A trader marks goods 40% above cost and gives a 15% discount. Net profit?\n\n`CP × 1.40 × 0.85 = CP × 1.19` → **19% profit**. One line, no equations.\n\n## Classic traps\n\n1. **Equal profit & loss on same SP:** selling two items at the same price, one at +x% and one at −x%, always nets a **loss** of x²/100 %.\n2. **False weights:** a dealer using 900g for 1kg while "selling at cost" earns 100/900 × 100 = 11.11% profit.\n3. Discount is always on **MP**, profit is always on **CP** — mixing these up is the most common error.\n\n## Worked example\n\n> SP ₹1080 after two successive discounts of 10% and 4% on MP. Find MP.\n\n`MP × 0.90 × 0.96 = 1080 → MP = 1250`.',
  1, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a1110000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a1110000-0000-4000-8000-000000000003', 'a1100000-0000-4000-8000-000000000002',
  'Ratio & Proportion Fundamentals', 'text',
E'# Ratio & Proportion\n\nRatios compare quantities; proportions equate two ratios. They underpin mixtures, partnership, and age problems.\n\n## Essentials\n\n- a : b = ka : kb for any k > 0 — always scale to smallest integers.\n- If a/b = c/d then ad = bc (cross-multiplication).\n- To split N in ratio a : b : c → shares are N·a/(a+b+c), etc.\n\n## Combining ratios\n\n> A : B = 2 : 3 and B : C = 4 : 5. Find A : B : C.\n\nMake B equal: LCM(3,4) = 12 → A : B = 8 : 12, B : C = 12 : 15 → **8 : 12 : 15**.\n\n## Partnership problems\n\nProfit divides in the ratio of (capital × time):\n\n> X invests ₹40k for 12 months, Y invests ₹60k for 8 months.\n\n`40×12 : 60×8 = 480 : 480 = 1 : 1` — equal shares despite different capital.\n\n## Ages trap\n\nRatios of ages change over time, differences do not. If ages are in ratio 5 : 7 now and 7 : 9 after 8 years, let ages be 5x, 7x → (5x+8)/(7x+8) = 7/9 → x = 4 → ages **20 and 28**.',
  0, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a1110000-0000-4000-8000-000000000003');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a1110000-0000-4000-8000-000000000004', 'a1100000-0000-4000-8000-000000000002',
  'Time, Speed & Distance', 'text',
E'# Time, Speed & Distance\n\n`Distance = Speed × Time` — every TSD question is this identity plus unit discipline.\n\n## Unit conversion\n\n- km/h → m/s: multiply by 5/18\n- m/s → km/h: multiply by 18/5\n\n## Average speed trap\n\nEqual **distances** at speeds a and b → average speed is the harmonic mean `2ab/(a+b)`, never (a+b)/2.\n\n> 60 km/h out, 40 km/h back → 2×60×40/100 = **48 km/h**.\n\n## Trains\n\n- Passing a pole: distance = train length.\n- Passing a platform: distance = train + platform length.\n- Opposite directions: speeds **add**. Same direction: speeds **subtract**.\n\n> A 240 m train crosses a 360 m platform in 24 s → speed = 600/24 = 25 m/s = **90 km/h**.\n\n## Boats & streams\n\n- Downstream speed = boat + stream; upstream = boat − stream.\n- Boat speed = (down + up)/2; stream speed = (down − up)/2.\n\n## Relative speed mindset\n\nTwo people closing a 100 m gap at 7 m/s and 3 m/s meet in 100/(7+3) = 10 s. Most "meeting point" questions fall to this single idea.',
  1, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a1110000-0000-4000-8000-000000000004');

-- Course 2: Logical Reasoning Mastery
INSERT INTO courses (id, title, description, category, difficulty, duration_hours, status, is_free, tags, total_modules, module_key)
SELECT 'a2000000-0000-4000-8000-000000000002', 'Logical Reasoning Mastery',
  'Crack series, coding-decoding, syllogisms, and arrangement puzzles — the reasoning section end to end.',
  'reasoning', 'intermediate', 10, 'published', TRUE, ARRAY['reasoning','logical','campus-prep'], 2, 'aptitude-reasoning'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE id = 'a2000000-0000-4000-8000-000000000002');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002',
  'Pattern-Based Reasoning', 'Number/letter series and coding-decoding — pure pattern spotting.', 0, 150
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a2100000-0000-4000-8000-000000000001');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002',
  'Analytical Reasoning', 'Syllogisms, blood relations, and seating arrangements.', 1, 150
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a2100000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a2110000-0000-4000-8000-000000000001', 'a2100000-0000-4000-8000-000000000001',
  'Number & Letter Series', 'text',
E'# Number & Letter Series\n\nSeries questions test whether you can spot the *rule* connecting consecutive terms. Check patterns in this order:\n\n1. **Constant difference** (arithmetic): 7, 12, 17, 22 → +5\n2. **Changing difference**: 2, 3, 5, 8, 12 → differences 1, 2, 3, 4\n3. **Ratio** (geometric): 3, 6, 12, 24 → ×2\n4. **Squares/cubes**: 1, 4, 9, 16 / 1, 8, 27, 64 — also n²±1, n³±n\n5. **Alternating/interleaved**: 1, 100, 4, 90, 9, 80 → two series woven together\n6. **Term combinations**: 2, 3, 6, 18, 108 → each term = product of previous two\n\n## Letter series\n\nAssign positions A=1 … Z=26 and treat as a number series.\n\n> J, M, P, S, ? → 10, 13, 16, 19 → 22 = **V**\n\nFor pairs like AZ, BY, CX — look for mirror pairs (opposite ends of alphabet).\n\n## Exam tactics\n\n- If differences look random, try **second differences** or ratios.\n- Series with a sudden jump usually mix two operations (×2 then +1, alternating).\n- Do not spend over 60 seconds; skip and return — series answers often become obvious on second look.',
  0, 35
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a2110000-0000-4000-8000-000000000001');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a2110000-0000-4000-8000-000000000002', 'a2100000-0000-4000-8000-000000000001',
  'Coding–Decoding', 'text',
E'# Coding–Decoding\n\nA word is transformed by a hidden rule; apply the same rule to the question word.\n\n## The four standard schemes\n\n**1. Letter shift:** CAT → FDW is +3 on each letter.\n\n**2. Reversal / positional swap:** BREAD → DAERB (reversed), or adjacent letters swapped.\n\n**3. Opposite letters (mirror):** A↔Z, B↔Y, C↔X. Check when the coded word looks unrelated. Handy check: mirror pairs sum to 27 (A=1 + Z=26).\n\n**4. Number/symbol substitution:** each letter mapped to its position (or position ± k).\n\n## Sentence coding\n\nGiven three coded sentences sharing words, intersect them:\n\n> "sky is blue" → ta pa na; "sea is deep" → ka pa ra\n\n"is" appears in both → **pa**. Eliminate word by word.\n\n## Conditional coding\n\nRules like "if a word starts with a vowel, reverse it first" — apply conditions in the stated order, never simultaneously.\n\n## Speed tip\n\nWrite the alphabet with positions once on your rough sheet at the start of the exam:\n`A1 B2 C3 D4 E5 F6 G7 H8 I9 J10 K11 L12 M13 N14 O15 P16 Q17 R18 S19 T20 U21 V22 W23 X24 Y25 Z26`\nEvery shift question becomes arithmetic.',
  1, 35
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a2110000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a2110000-0000-4000-8000-000000000003', 'a2100000-0000-4000-8000-000000000002',
  'Syllogisms with Venn Diagrams', 'text',
E'# Syllogisms\n\nGiven statements assumed true, decide which conclusions **must** follow. Draw the minimal Venn diagram — never reason verbally.\n\n## The four statement types\n\n| Statement | Diagram |\n|---|---|\n| All A are B | A inside B |\n| No A is B | disjoint circles |\n| Some A are B | overlapping circles |\n| Some A are not B | A partly outside B |\n\n## Golden rules\n\n1. A conclusion is valid only if it holds in **every** possible diagram, not just one convenient drawing.\n2. "Some A are B" also proves "Some B are A" — but "All A are B" does **not** prove "All B are A".\n3. Two negative statements → no valid conclusion connecting the end terms.\n4. **Either–or cases:** when neither "Some A are B" nor "No A is B" is certain but together they cover all diagrams, the answer is "either conclusion I or II follows".\n\n## Worked example\n\n> All pens are books. Some books are boards.\n> I: Some pens are boards. II: Some boards are books.\n\nDraw pens inside books; boards may overlap books without touching pens → I is **not** certain. II restates statement 2 → **only II follows**.\n\n## Possibility questions\n\n"Can some A be C?" asks whether *any* legal diagram allows it — much weaker than "must follow". Try to construct one diagram where it happens.',
  0, 40
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a2110000-0000-4000-8000-000000000003');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a2110000-0000-4000-8000-000000000004', 'a2100000-0000-4000-8000-000000000002',
  'Blood Relations & Seating Arrangements', 'text',
E'# Blood Relations & Seating Arrangements\n\n## Blood relations\n\nDraw a family tree as you read — squares for males, circles for females, vertical lines for parent-child, horizontal for siblings/spouses.\n\n> "Pointing to a photo, Ravi says: her mother is the only daughter of my grandfather."\n\nOnly daughter of Ravi''s grandfather = Ravi''s mother → the woman''s mother is Ravi''s mother → the woman is Ravi''s **sister**.\n\nWatch for: "only son/daughter" (uniqueness), and gender left ambiguous until the last clue.\n\n## Circular seating\n\n- **Facing centre:** left = clockwise, right = anti-clockwise.\n- **Facing outward:** directions flip.\n- Fix the most-constrained person first, then place neighbours.\n\n> 6 people at a round table. A is second to the left of B; C is opposite A; D is not adjacent to B.\n\nPin A, walk two places clockwise for B, place C opposite A, then test D''s options — one arrangement survives.\n\n## Linear seating\n\n"X is to the left of Y" does **not** mean immediately left unless stated. Track facing direction — for a row facing you, their left is your right.\n\n## Puzzle discipline\n\n1. List all entities and constraints first.\n2. Start from absolute constraints (ends, opposites, fixed seats).\n3. Branch on binary choices and eliminate — never hold more than two open branches mentally; write them down.',
  1, 40
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a2110000-0000-4000-8000-000000000004');

-- Course 3: Data Interpretation & Core Maths
INSERT INTO courses (id, title, description, category, difficulty, duration_hours, status, is_free, tags, total_modules, module_key)
SELECT 'a3000000-0000-4000-8000-000000000003', 'Data Interpretation & Core Maths',
  'Read charts fast and nail averages, mixtures, and interest problems — where accuracy wins over speed.',
  'maths', 'intermediate', 8, 'published', TRUE, ARRAY['maths','data-interpretation','campus-prep'], 2, 'aptitude-reasoning'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE id = 'a3000000-0000-4000-8000-000000000003');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a3100000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
  'Data Interpretation', 'Tables, bar charts, pie charts, and line graphs under time pressure.', 0, 120
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a3100000-0000-4000-8000-000000000001');

INSERT INTO course_modules (id, course_id, title, description, sort_order, estimated_minutes)
SELECT 'a3100000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003',
  'Averages, Mixtures & Interest', 'The arithmetic trio behind most miscellaneous questions.', 1, 120
WHERE NOT EXISTS (SELECT 1 FROM course_modules WHERE id = 'a3100000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a3110000-0000-4000-8000-000000000001', 'a3100000-0000-4000-8000-000000000001',
  'Tables, Bar & Pie Charts', 'text',
E'# Data Interpretation: Tables, Bar & Pie Charts\n\nDI questions are arithmetic on data you must first *locate*. Speed comes from scanning technique, not faster calculation.\n\n## Before touching any question\n\n1. Read the title, axis labels, units, and footnotes (10 seconds).\n2. Note whether values are absolute or percentages.\n3. Check whether totals are given or must be computed.\n\n## Pie charts\n\n- Whole circle = 360° = 100%. 1% = 3.6°.\n- If a sector is 72°, it is 72/3.6 = **20%** of the total.\n- Two pie charts (e.g. income vs expenditure) can only be compared if both totals are known.\n\n## Percentage change questions\n\n"Growth from 2023 to 2024" = (new − old)/**old** × 100. The denominator is always the earlier value.\n\n## Approximation discipline\n\nOptions are usually 5%+ apart — round aggressively:\n\n> 4832/6.12 ≈ 4800/6 = 800\n\nOnly compute exactly when two options are close.\n\n## Common traps\n\n- Ratio of percentages ≠ ratio of values unless bases are equal.\n- "Average annual growth" ≠ total growth ÷ years when compounding is involved.\n- Watch units switching between thousands and lakhs mid-table.',
  0, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a3110000-0000-4000-8000-000000000001');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a3110000-0000-4000-8000-000000000002', 'a3100000-0000-4000-8000-000000000001',
  'Line Graphs & Combined Data Sets', 'text',
E'# Line Graphs & Combined Data Sets\n\nLine graphs show trends over time; combined sets (graph + table) require joining two sources.\n\n## Reading trends\n\n- Steepest segment = largest **absolute** change; largest percentage change depends on the base value.\n- Crossing lines = the two series swap ranking at that point — a favourite question spot.\n\n## Combined data sets\n\n> Line graph: total students per year. Table: percentage of girls per year. Question: number of boys in 2024.\n\nJoin: total(2024) × (1 − girls%(2024)). Write the join formula *before* looking up numbers — prevents unit errors.\n\n## Cumulative vs per-period\n\nIf the graph shows *cumulative* production, output in year N = value(N) − value(N−1). Misreading cumulative data as per-year is the most damaging DI mistake.\n\n## Ratio shortcuts\n\nWhen a question asks "ratio of A''s sales to B''s sales across all years", sum only if asked for aggregate — often the ratio is for a single year, and summing wastes a minute.\n\n## Time management\n\nA DI set of 5 questions typically has 3 easy, 1 medium, 1 long calculation. Do the easy 3 first; the long one is often worth skipping in a sectional-cutoff exam.',
  1, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a3110000-0000-4000-8000-000000000002');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a3110000-0000-4000-8000-000000000003', 'a3100000-0000-4000-8000-000000000002',
  'Averages, Mixtures & Alligation', 'text',
E'# Averages, Mixtures & Alligation\n\n## Averages\n\n- Average = sum / count; so **sum = average × count** — the form you actually use.\n- Adding a value above the average pulls it up by (value − avg)/(n+1).\n\n> Average of 30 students is 62. Teacher''s mark included makes it 63. Teacher''s mark?\n\nNew sum = 63×31 = 1953; old sum = 62×30 = 1860 → **93**.\n\n## Weighted average\n\n`(n₁a₁ + n₂a₂)/(n₁+n₂)` — combining class sections, or petrol bought at two prices.\n\n## Alligation (the cross method)\n\nTo mix ingredients at prices a < b to hit mean m:\n\n```\n  a         b\n     \\    /\n       m\n     /    \\\nb−m        m−a\n```\n\nRatio (cheaper : dearer) = (b−m) : (m−a).\n\n> Mix rice at ₹40 and ₹60 to sell at ₹45 → ratio = (60−45):(45−40) = **3 : 1**.\n\n## Replacement problems\n\nRemoving and replacing k litres from V litres of pure liquid, n times:\n`final purity = (1 − k/V)ⁿ`\n\n> 10 L of milk, replace 2 L with water twice → 10 × (0.8)² = **6.4 L milk**.',
  0, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a3110000-0000-4000-8000-000000000003');

INSERT INTO lessons (id, module_id, title, content_type, content_text, sort_order, estimated_minutes)
SELECT 'a3110000-0000-4000-8000-000000000004', 'a3100000-0000-4000-8000-000000000002',
  'Simple & Compound Interest', 'text',
E'# Simple & Compound Interest\n\n## Formulas\n\n- Simple: `SI = P·r·t/100` — interest is the same every year.\n- Compound: `A = P(1 + r/100)ᵗ`, `CI = A − P` — interest earns interest.\n- Half-yearly compounding: rate halves, periods double.\n\n## SI vs CI difference (2 years)\n\n`CI − SI = P(r/100)²` — asked constantly.\n\n> P = 8000, r = 5%: difference = 8000 × 0.0025 = **₹20**.\n\nFor 3 years: `P(r/100)²(3 + r/100)`.\n\n## Doubling shortcuts\n\n- SI: money doubles when r·t = 100 (e.g. 12.5% → 8 years).\n- CI: rule of 72 — doubling time ≈ 72/r years (10% → ~7.2 years).\n\n## Successive years as multipliers\n\nCI at 10% for 3 years = ×1.1 ×1.1 ×1.1 = ×1.331 → 33.1% total. This is the same successive-percentage idea from the percentages lesson — the syllabus is one connected web.\n\n## Instalment problems\n\nEqual annual instalment X clearing debt P at r% CI over n years satisfies: sum of present values of instalments = P. For 2 years: `X/(1+r/100) + X/(1+r/100)² = P`.\n\n## Exam tip\n\nWhen options are far apart, approximate CI as SI + small correction — for 2-3 years at ≤10% this identifies the answer without full expansion.',
  1, 30
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE id = 'a3110000-0000-4000-8000-000000000004');

-- Keep total_modules accurate for the seeded courses (idempotent recount).
UPDATE courses c SET total_modules = (
  SELECT COUNT(*) FROM course_modules m WHERE m.course_id = c.id
)
WHERE c.id IN (
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003'
);
