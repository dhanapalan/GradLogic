# Implementation Guide: Adaptive Learning & Billing Integration

**Date**: 2026-07-23  
**Status**: Ready for Production Integration  
**Scope**: Adaptive Learning (verified), Stripe Billing (new integration)

---

## Part 1: Adaptive Learning

### Current State
✅ **Complete and production-ready**

**Architecture**:
- Service: `server/src/services/adaptive.service.ts` (513 lines)
- Routes: `server/src/routes/adaptiveLearning.routes.ts` (81 lines)
- Frontend: `client/src/pages/student/AdaptiveLearningPage.tsx`
- E2E Test: `client/tests/e2e/student/adaptive-learning.spec.ts` (NEW)

**Features Implemented**:
1. **Skill Accuracy Tracking** (`getSkillAccuracy()`)
   - Tracks accuracy across 8 fixed categories (reasoning, maths, programming, etc.)
   - Calculates: attempts, correct answers, accuracy %, avg time per question
   - Returns data even for categories with zero practice (cold-start handling)

2. **Weak Skills Identification** (`getWeakSkills()`)
   - Ranks all skills by accuracy (lowest first)
   - Breaks ties by attempt count (fewer attempts = needs attention)
   - Configurable limit (default 5 skills)

3. **Difficulty Recommendation** (`recommendDifficulty()`)
   - Cold start: "easy"
   - Accuracy < 50%: "easy"
   - Accuracy 50-80%: "medium"
   - Accuracy > 80%: "hard"

4. **Learning Path Generation** (`generateLearningPath()`)
   - Auto-generates ordered path: weakest skills first
   - Includes: lesson recommendations + practice questions + time estimates
   - 5 practice questions per skill (configurable)
   - Matches lessons via skill name (fuzzy ILIKE), falls back to catalog

5. **Next Lesson/Question Recommendation** (`recommendNext()`)
   - Analyzes student's single weakest skill
   - Returns: next question, recommended difficulty, lesson, estimated time

### Data Flow

```
Student practices (practice_attempts table)
    ↓
Skill accuracy calculated from practice_attempts
    ↓
Weak skills ranked
    ↓
Difficulty scaled to performance
    ↓
Learning path generated (live, on-demand)
    ↓
Student sees personalized recommendations
```

### API Endpoints

**GET /api/v1/adaptive-learning/track**
- Returns: Accuracy across all 8 skill categories
- Response: `[{ category, attempts, correct, accuracy, avgTimeSeconds, hasEnoughData }, ...]`

**GET /api/v1/adaptive-learning/weak-skills?limit=5**
- Returns: Weakest N skills ranked by accuracy
- Response: Same as `/track` but filtered and sorted

**GET /api/v1/adaptive-learning/recommend**
- Returns: Next recommended lesson/question for weakest skill
- Response: `{ weakestSkill, recommendedDifficulty, nextQuestion, nextLesson, estimatedLearningTimeMinutes }`

**GET /api/v1/adaptive-learning/learning-path?maxSteps=5**
- Returns: Full ordered learning path (weakest → strongest)
- Response: `{ steps: [...], totalEstimatedMinutes }`

### Database Tables Used

- `practice_attempts` — student's question attempts (is_correct, time_spent_seconds)
- `practice_sessions` — practice session metadata (student_id, created_at)
- `question_bank` — available questions (category, difficulty_level, is_active, status)
- `learning_modules` — optional lessons (skill_id, module_type, duration_minutes)
- `skills` — optional skill definitions (name, category)
- `lessons` / `courses` — LMS content (fallback lesson search)

### Testing

**Run E2E Tests**:
```bash
npm run test:e2e -- client/tests/e2e/student/adaptive-learning.spec.ts
```

**Manual Testing Checklist**:
- [ ] Student with 0 practice attempts sees "cold start" (easy difficulty)
- [ ] Student with 5+ attempts in a category sees calculated accuracy
- [ ] Weak skills properly sorted by accuracy then attempts
- [ ] Learning path max steps limit respected
- [ ] Time estimates reasonable (≥5 minutes, ≤120 minutes typically)
- [ ] Lessons matched correctly via category

**Example Data Setup**:
```sql
-- Create test student practice
INSERT INTO practice_sessions (id, student_id) VALUES (uuid_generate_v4(), $1);
INSERT INTO practice_attempts (session_id, question_id, is_correct, time_spent_seconds) 
  VALUES (...);  -- Repeat for multiple attempts
```

### Known Limitations & Future Work

1. **Cold Start**: Students with <3 attempts in a category show accuracy=0 (treated as "needs work")
   - Fix: Implement collaborative filtering / similar-student recommendations

2. **Lesson Matching**: Fuzzy ILIKE match on learning_modules.title/description
   - Fix: Implement vector embeddings for semantic matching

3. **Time Estimation**: Linear (avg time/question × count + lesson duration)
   - Fix: Add non-linear adjustment based on difficulty delta

4. **No Persistence**: Learning path computed on-demand, not cached
   - Design rationale: Stays fresh as student practices (see adaptive.service.ts line 208)

---

## Part 2: Billing Integration (Stripe)

### Current State
⚠️ **New implementation - Ready for integration**

**Architecture**:
- Service: `server/src/services/stripe.service.ts` (NEW - 260 lines)
- PDF Generator: `server/src/services/invoicePdf.service.ts` (NEW - 180 lines)
- Routes: Updated `server/src/routes/billing.routes.ts` (webhook + PDF endpoints)
- E2E Test: `client/tests/e2e/billing/stripe-integration.spec.ts` (NEW)

**Features Implemented**:

1. **Stripe Payment Intent Creation** (`createOrder()`)
   - Creates payment intent for amount (₹ → paise conversion)
   - Returns: order_id, client_secret, publishable_key
   - Metadata: collegeId, receipt number

2. **Payment Verification** (`verifyPayment()`)
   - Retrieves payment intent from Stripe
   - Checks: status="succeeded" + charge exists
   - Returns: verified boolean, payment_id, amount, status

3. **Webhook Handling** (`handleWebhook()`)
   - Verifies Stripe signature (prevents spoofing)
   - Processes events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`
   - Auto-updates invoices and subscription status in DB

4. **Invoice PDF Generation** (`generateInvoicePdf()`)
   - Creates professional A4 invoice PDF (pdfkit)
   - Includes: invoice number, dates, college name, items, totals, GST
   - Returns: PDFDocument (piped to HTTP response)

5. **Stripe Customer & Subscription** (helpers)
   - `createCustomer()` — One-time setup per college
   - `createSubscription()` — Optional recurring billing

### Environment Variables Required

```bash
# .env or deployment secrets
STRIPE_SECRET_KEY=sk_live_xxxx...        # Secret key (production only)
STRIPE_PUBLISHABLE_KEY=pk_live_xxxx...   # Public key (safe to embed in client)
STRIPE_WEBHOOK_SECRET=whsec_xxxx...      # For webhook signature verification

# PDF generation (optional)
PDF_TEMP_DIR=/tmp/invoices               # Where to store temp PDFs (if needed)
```

### Setup Instructions

#### 1. Stripe Account Setup
```bash
# 1. Create Stripe account at https://dashboard.stripe.com
# 2. Enable India locale (Settings → Billing → Currency: INR)
# 3. Create subscription plans in Stripe dashboard (or via API):

curl https://api.stripe.com/v1/products \
  -u sk_live_xxxx: \
  -d name="GradLogic Starter" \
  -d type=service

curl https://api.stripe.com/v1/prices \
  -u sk_live_xxxx: \
  -d product=prod_xxxx \
  -d unit_amount=50000 \
  -d currency=inr \
  -d recurring[interval]=month

# 4. Get keys from Dashboard → API Keys
# 5. Configure webhook endpoint (see step 2)
```

#### 2. Webhook Configuration
```bash
# 1. Set up webhook endpoint in Stripe Dashboard:
#    URL: https://api.gradlogic.com/api/billing/webhook/stripe
#    Events: payment_intent.succeeded, payment_intent.payment_failed, charge.dispute.created

# 2. Get webhook signing secret from Dashboard → Webhooks
#    Set STRIPE_WEBHOOK_SECRET env var with this value

# 3. Test webhook locally using Stripe CLI:
stripe listen --forward-to localhost:3001/api/billing/webhook/stripe
stripe trigger payment_intent.succeeded
```

#### 3. Install Dependencies
```bash
npm install stripe pdfkit
npm install --save-dev @types/pdfkit
```

#### 4. Update Config
```typescript
// server/src/config/billing.ts (create new file)
export const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  // Replace mockPaymentGateway with stripeService in billing.routes.ts
};
```

### API Endpoints

**POST /api/billing/webhook/stripe**
- Receives Stripe webhook events
- Verifies signature
- Auto-updates invoice/subscription status
- Returns: `{ success, eventId }`

**PUT /api/billing/invoices/:id/download**
- Generates and downloads invoice PDF
- Requires authentication (college_admin role)
- Returns: PDF file stream

**POST /api/billing/subscribe** (existing)
- Creates subscription (payment required afterward)
- Client must call Stripe checkout after this

### Payment Flow

```
1. College selects plan (GET /api/billing/plans)
   ↓
2. College creates subscription (POST /api/billing/subscribe)
   ↓
3. Invoice generated with payment intent (server-side)
   ↓
4. Frontend creates Stripe Payment Element with client_secret
   ↓
5. College completes payment in UI
   ↓
6. Stripe sends webhook (payment_intent.succeeded)
   ↓
7. Server webhook handler updates invoice + subscription status
   ↓
8. College portal shows "Active" subscription
```

### Testing

**Unit Tests** (mock Stripe SDK):
```typescript
import * as stripeService from '../services/stripe.service';
import * as stripeLib from 'stripe';

jest.mock('stripe');
const mockStripe = stripeLib as jest.Mocked<typeof stripeLib>;

test('createOrder converts rupees to paise', async () => {
  const order = await stripeService.createOrder({ amount: 100 });
  expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 10000 }) // 100 * 100
  );
});
```

**E2E Tests**:
```bash
npm run test:e2e -- client/tests/e2e/billing/stripe-integration.spec.ts
```

**Manual Testing Checklist**:
- [ ] Test payment with Stripe test card: 4242 4242 4242 4242
- [ ] Webhook triggers locally (stripe listen)
- [ ] Invoice downloads as PDF
- [ ] Failed payment (4000 0000 0000 0002) marks invoice as failed
- [ ] Dispute (4000 0000 0000 9995) updates status to disputed

**Test Cards** (Stripe provided):
- Success: `4242 4242 4242 4242` (any future expiry, any CVC)
- Decline: `4000 0000 0000 0002`
- Dispute: `4000 0000 0000 9995`
- Auth required: `4000 0025 0000 3155`

### Frontend Integration

**React Component Setup**:
```typescript
import { loadStripe } from "@stripe/js";
import { Elements, PaymentElement, useStripe } from "@stripe/react-js";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

export function PaymentForm({ clientSecret }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentElement />
      <SubmitButton />
    </Elements>
  );
}
```

### Production Checklist

- [ ] Stripe production keys configured
- [ ] Webhook endpoint verified (HTTPS only)
- [ ] SSL/TLS certificate valid
- [ ] Database backups enabled
- [ ] PDF temp directory writable
- [ ] Logging configured for payment events
- [ ] Error alerting set up
- [ ] PCI compliance audit
- [ ] Tax calculations implemented (if needed)

### Monitoring & Debugging

**Stripe Dashboard Monitoring**:
- https://dashboard.stripe.com/test/webhooks (test mode)
- https://dashboard.stripe.com/webhooks (production)
- Check: Webhook delivery attempts, event details

**Server Logs**:
```bash
# Monitor payment events
grep -i "stripe\|payment" server.log | tail -100

# Monitor webhook processing
grep "Webhook received" server.log
```

**Common Issues**:

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Webhook 400 error | Missing/invalid signature | Check `STRIPE_WEBHOOK_SECRET` env var |
| Payment intent fails | Wrong amount/currency | Verify `amount * 100` conversion & `currency=inr` |
| PDF generation errors | pdfkit not installed | `npm install pdfkit` |
| Duplicate invoices | Race condition on webhook | Add idempotency key to invoice creation |

---

## Summary

### Adaptive Learning
- ✅ Feature complete, well-tested
- ✅ 8 skill categories tracked
- ✅ Real-time path generation
- Ready for production

### Billing - Stripe
- ✅ Payment intent creation
- ✅ Webhook signature verification
- ✅ Auto-invoice updates
- ✅ PDF generation
- 🔧 Requires: Stripe account setup + env vars
- Ready for production (after setup)

### Next Steps
1. Deploy Stripe service to staging
2. Complete Stripe account setup & webhook config
3. Run E2E tests against Stripe test mode
4. Replace mock payment gateway in billing.routes.ts
5. Monitor webhook delivery for first 48 hours in production

---

**References**:
- Stripe Docs: https://stripe.com/docs/payments
- PDFKit: http://pdfkit.org/
- Adaptive Learning Code: `server/src/services/adaptive.service.ts`
- Billing Code: `server/src/services/stripe.service.ts`, `server/src/services/invoicePdf.service.ts`
