# Local Admin Portal Preview Guide

**View the SuperAdmin Portal locally with all new features**

---

## 🚀 Quick Start (Option 1: Recommended)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL client (optional)

### Step 1: Start Backend Services

```bash
# Start PostgreSQL, Redis, MinIO, and Nginx
docker-compose up -d

# Wait for services to be healthy (30-60 seconds)
# Check status:
docker-compose ps
```

### Step 2: Install Dependencies & Run Migrations

```bash
# Install all dependencies
npm install

# Run database migrations (creates tables including billing, approvals)
# migrations auto-apply from docker/init-db on first DB boot (see README)

# Seed test data (optional)
npx prisma db seed
```

### Step 3: Start Development Servers

```bash
# Start both client and server in parallel
npm run dev

# You'll see:
# ✓ Server running on http://localhost:5050
# ✓ Client running on http://localhost:5173
```

### Step 4: Login & View Admin Pages

```
URL: http://localhost:5173
```

**Login as Super Admin:**
- Email: `admin@example.com`
- Password: `YourPassword1` (or check .env for ADMIN_PASSWORD)

---

## 📍 Admin Pages to Preview

### 1. **Question Bank** (Global Content Management)
**URL**: http://localhost:5173/app/question-bank

- Global question library
- Create/edit/delete questions
- Filter by category, difficulty, type
- Bulk operations

### 2. **Pending Approvals** (College Onboarding Gate)
**URL**: http://localhost:5173/app/approvals/pending

- List of pending college approvals
- Approve/Reject with inline actions
- Rejection reason modal
- View college details

### 3. **Campuses** (College Management)
**URL**: http://localhost:5173/app/campuses

- List all campuses
- Filter by status (pending/approved/rejected)
- Create new campus
- Edit campus details

### 4. **Billing Dashboard** (College Admin Portal)
**URL**: http://localhost:5173/app/college/billing

Login as College Admin to see:
- Current subscription status
- Available subscription plans
- Invoice history
- Billing contacts management

**College Admin Credentials:**
- Email: `college@example.com`
- Password: `YourPassword1`

---

## 🗄️ Database Tables Created

All three modules have been integrated into the database:

```sql
-- College Approval
SELECT * FROM colleges 
WHERE approval_status IN ('pending', 'approved', 'rejected');

-- Billing System
SELECT * FROM subscription_plans;
SELECT * FROM subscriptions;
SELECT * FROM invoices;
SELECT * FROM billing_contacts;
SELECT * FROM usage_metrics;

-- Question Bank (existing)
SELECT * FROM question_bank;
```

---

## 📊 Test Data Available

### Seed Subscription Plans
```sql
INSERT INTO subscription_plans (name, tier, price_per_month)
VALUES 
  ('Free', 'free', 0),
  ('Starter', 'starter', 5000),
  ('Professional', 'professional', 15000),
  ('Enterprise', 'enterprise', 50000);
```

### Create Test College (for approval)
```bash
# Via API
curl -X POST "http://localhost:5050/api/campuses" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test University",
    "city": "Bangalore",
    "state": "Karnataka"
  }'
```

---

## 🐳 Option 2: Full Docker Deployment

```bash
# Build and start everything in Docker
docker-compose up -d

# Wait for services to be healthy
docker-compose logs -f server

# Access at http://localhost:5173
```

---

## 🔑 Test Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Super Admin | admin@example.com | YourPassword1 | All admin features |
| HR Admin | hr@example.com | YourPassword1 | HR dashboard |
| College Admin | college@example.com | YourPassword1 | College billing |
| Student | student@example.com | YourPassword1 | Student portal |

---

## 📱 Feature Walkthrough

### Question Bank
1. Navigate to **"Question Bank"** in sidebar (super_admin/hr only)
2. Click "Add Question" or browse existing questions
3. Create a new question (multiple choice, short answer, etc.)
4. Filter by category/difficulty
5. Edit or delete questions

### College Approval
1. Navigate to **"Pending Approvals"** in sidebar
2. View all pending colleges
3. Click "Approve" to activate a college
4. Click "Reject" and provide reason
5. Approved colleges appear in **Campuses** list

### Billing Dashboard
1. Login as **College Admin**
2. Navigate to **"Billing"** in sidebar
3. View current subscription (if any)
4. Browse available plans
5. Click "Select Plan" to subscribe
6. View invoices and billing contacts

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# If port 5173 (client) is in use:
cd client && npm run dev -- --port 5174

# If port 5050 (server) is in use:
cd server && npm run dev -- --port 5001
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# If not, start it:
docker-compose up postgres -d

# Run migrations again:
# migrations auto-apply from docker/init-db on first DB boot (see README)
```

### Missing Test Data
```bash
# Seed the database
npx prisma db seed
```

### Clear Everything & Start Fresh
```bash
# Stop all containers
docker-compose down -v

# Remove node_modules and lock files (if needed)
rm -rf node_modules package-lock.json

# Fresh start
docker-compose up -d
npm install
# migrations auto-apply from docker/init-db on first DB boot (see README)
npm run dev
```

---

## 📊 API Endpoints for Testing

### Question Bank API
```bash
# List questions
curl http://localhost:5050/api/question-bank

# Create question
curl -X POST http://localhost:5050/api/question-bank \
  -H "Content-Type: application/json" \
  -d '{"category":"programming","type":"multiple_choice",...}'
```

### College Approval API
```bash
# List pending
curl http://localhost:5050/api/campuses/approval/pending

# Approve
curl -X POST http://localhost:5050/api/campuses/ID/approve

# Reject
curl -X POST http://localhost:5050/api/campuses/ID/reject \
  -d '{"rejection_reason":"..."}'
```

### Billing API
```bash
# List plans
curl http://localhost:5050/api/billing/plans

# Create subscription
curl -X POST http://localhost:5050/api/billing/subscribe \
  -d '{"plan_id":"...","billing_cycle":"monthly"}'
```

---

## 🎬 Suggested Testing Flow

1. **Start servers** (`npm run dev`)
2. **Login as Super Admin**
3. **Browse Question Bank** → Create sample question
4. **Check Pending Approvals** → Create test college via API, then approve it
5. **Login as College Admin**
6. **View Billing Dashboard** → Select a plan, see invoice created
7. **Return to Super Admin** → View new invoices

---

## 📸 Screenshots Location

After testing, screenshots will be helpful for documentation:
- Question Bank: Save screenshot of question list
- Approval Queue: Save before/after screenshots
- Billing Dashboard: Save plan selection and invoice list

---

## ✅ Checklist for Manual Testing

- [ ] Server starts without errors
- [ ] Client loads at http://localhost:5173
- [ ] Can login as super_admin
- [ ] Question Bank page loads
- [ ] Can create a question
- [ ] Can search knowledge base
- [ ] Pending Approvals page loads
- [ ] Can create/view colleges
- [ ] Can approve a college
- [ ] Can reject with reason
- [ ] Login as college_admin
- [ ] Billing page loads
- [ ] Can view plans
- [ ] Can select a plan
- [ ] Can view invoice
- [ ] Navigation works smoothly
- [ ] No console errors (F12 → Console)

---

## 🚀 Next Steps After Testing

1. **Document findings** - Note any UI tweaks needed
2. **Test edge cases** - Try rejecting, creating duplicates, etc.
3. **Performance check** - Monitor network tab (F12 → Network)
4. **Database check** - Verify data in postgres via psql or Prisma Studio
5. **Ready for deployment** - All modules working locally

---

## 📞 Need Help?

If something doesn't work:

1. Check server logs: `docker-compose logs server`
2. Check client console: Open DevTools (F12) → Console
3. Check database: `npx prisma studio`
4. Restart services: `docker-compose restart`
5. Check .env file: Ensure all configs are set

---

**Happy testing! 🎉**
