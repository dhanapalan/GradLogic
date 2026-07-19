# Multi-Domain Architecture Implementation Plan

**Vision**: Separate professional portals for Super Admin, College Admin, and Students with automatic role detection and college branding  
**Timeline**: Phase 1 (3-4 weeks) + Phase 2 (2-3 weeks)  
**Status**: 🟡 PLANNING - Ready for Development

---

## Current State vs. Target State

### Current Architecture ❌
```
localhost:5173 (all-in-one)
├─ Super Admin (admin@gradlogic.com)
├─ College Admin (college@gradlogic.com)
└─ Student (student@example.edu)

Issues:
- Single domain for all roles
- Role selector on login (confusing)
- No multi-tenancy support
- Shared UI for different personas
- Poor branding/customization
- SEO disadvantage
```

### Target Architecture ✅

**Phase 1 (Immediate)**
```
admin.gradlogic.ai → Super Admin Portal
portal.gradlogic.ai → College Admin Portal
student.gradlogic.ai → Student Portal

✓ Auto-role detection (email domain)
✓ Role-specific UI/theme
✓ College branding in portal.gradlogic.ai
✓ Independent deployment
✓ Better security isolation
```

**Phase 2 (Future)**
```
kpriet.gradlogic.ai → KPRIET college portal
cit.gradlogic.ai → CIT college portal
placement.kpriet.edu → Custom domain support

✓ White-label multi-tenancy
✓ Custom branding per college
✓ Separate analytics per college
```

---

## Phase 1: Separate Domain Implementation (3-4 weeks)

### Week 1: Infrastructure & DNS Setup

#### Tasks
1. **Register Domains**
   - [ ] `admin.gradlogic.ai` (Super Admin)
   - [ ] `portal.gradlogic.ai` (College Admin)
   - [ ] `student.gradlogic.ai` (Student)
   
   **Estimated Cost**: $3-5/month for all 3 domains

2. **DNS Configuration**
   ```
   admin.gradlogic.ai → API Gateway → admin-portal (port 5173)
   portal.gradlogic.ai → API Gateway → college-portal (port 5174)
   student.gradlogic.ai → API Gateway → student-portal (port 5175)
   ```

3. **SSL/TLS Certificates**
   - Use Let's Encrypt (free) or AWS Certificate Manager
   - Wildcard cert: `*.gradlogic.ai` for all subdomains
   - Auto-renewal setup

4. **Environment Configuration**
   ```bash
   # .env files per domain
   VITE_API_URL=https://api.gradlogic.ai/api
   VITE_APP_DOMAIN=admin.gradlogic.ai
   VITE_ROLE_PORTAL=super-admin
   ```

**Effort**: 2-3 hours setup, 4-6 hours testing

---

### Week 2: Authentication & Role Detection

#### Task 1: Email-Based Role Detection System

**File**: `server/src/auth/roleDetection.ts` (NEW)

```typescript
interface RoleDetectionResult {
  role: 'super_admin' | 'college_admin' | 'faculty' | 'student';
  college_id?: string;
  domain?: string;
}

export async function detectRoleFromEmail(email: string): Promise<RoleDetectionResult> {
  // 1. Check if super admin email
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return { role: 'super_admin' };
  }

  // 2. Check domain in email
  const domain = email.split('@')[1];
  const college = await db.college.findFirst({
    where: { email_domain: domain }
  });

  if (college) {
    // 3. Check if user is admin for this college
    const admin = await db.college_admin.findFirst({
      where: { email, college_id: college.id }
    });
    if (admin) return { role: 'college_admin', college_id: college.id, domain };

    // 4. Otherwise student
    return { role: 'student', college_id: college.id, domain };
  }

  // 5. Default: student (no college assigned yet)
  return { role: 'student' };
}
```

#### Task 2: Remove Role Selector from Login Page

**File**: `client/src/pages/auth/LoginPage.tsx` (MODIFY)

**Before**:
```jsx
<div className="role-selector">
  <label>
    <input type="radio" name="role" value="super-admin" /> Super Admin
  </label>
  <label>
    <input type="radio" name="role" value="college-admin" /> College Admin
  </label>
  <label>
    <input type="radio" name="role" value="student" /> Student
  </label>
</div>
```

**After**:
```jsx
<form onSubmit={handleLogin}>
  <input 
    type="email" 
    placeholder="Email" 
    onChange={(e) => {
      setEmail(e.target.value);
      detectRole(e.target.value);
    }}
  />
  {detectedRole && (
    <p className="text-xs text-gray-500">
      ✓ {roleLabelMap[detectedRole]}
    </p>
  )}
  <input type="password" placeholder="Password" />
  <button type="submit">Continue</button>
</form>
```

#### Task 3: Post-Login Routing

**File**: `client/src/hooks/useAuthRedirect.ts` (NEW)

```typescript
export function useAuthRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Detect current domain
    const domain = window.location.hostname;
    const role = user.role;

    // Verify user's role matches portal domain
    const validDomains = {
      'super_admin': 'admin.gradlogic.ai',
      'college_admin': 'portal.gradlogic.ai',
      'student': 'student.gradlogic.ai'
    };

    const expectedDomain = validDomains[role];

    if (domain !== expectedDomain && !isDevelopment()) {
      // Redirect to correct domain
      window.location.href = `https://${expectedDomain}${window.location.pathname}`;
      return;
    }

    // Route to dashboard
    const dashboardMap = {
      'super_admin': '/app/superadmin/dashboard',
      'college_admin': '/app/college-portal/dashboard',
      'student': '/app/student-portal'
    };

    navigate(dashboardMap[role]);
  }, [user]);
}
```

**Effort**: 8-10 hours

---

### Week 3: Separate Portal Applications

#### Option A: Single App with Domain-Based Routing (Recommended)

Keep one codebase, use `window.location.hostname` to control:
- Which layout/components render
- Which features are visible
- Which API endpoints are called
- Theme/branding

**File**: `client/src/config/portalConfig.ts` (NEW)

```typescript
export const getPortalConfig = () => {
  const domain = window.location.hostname;

  if (domain.includes('admin.gradlogic.ai')) {
    return {
      portalType: 'super-admin',
      apiUrl: 'https://api.gradlogic.ai',
      theme: 'admin-theme',
      features: ['college-management', 'analytics', 'approvals', 'question-bank'],
    };
  }

  if (domain.includes('portal.gradlogic.ai')) {
    return {
      portalType: 'college-admin',
      apiUrl: 'https://api.gradlogic.ai',
      theme: 'college-theme',
      features: ['student-management', 'billing', 'campaigns', 'campus-admins'],
    };
  }

  if (domain.includes('student.gradlogic.ai')) {
    return {
      portalType: 'student',
      apiUrl: 'https://api.gradlogic.ai',
      theme: 'student-theme',
      features: ['learning', 'practice', 'exams', 'results', 'profile'],
    };
  }

  // Default: detect from role
  return getDefaultConfig();
};
```

**Effort**: 6-8 hours

---

### Week 4: Dynamic Login Page & College Branding

#### Task 1: Enhanced Login Page with Dynamic Content

**File**: `client/src/pages/auth/EnhancedLoginPage.tsx` (NEW)

```jsx
export function EnhancedLoginPage() {
  const [aiFeature, setAiFeature] = useState(0);
  const [stats, setStats] = useState(null);

  // Rotate AI features every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAiFeature((prev) => (prev + 1) % AI_FEATURES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live stats
  useEffect(() => {
    fetchPlatformStats().then(setStats);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left Panel: Dynamic Content */}
      <div className="w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex flex-col justify-between">
        
        {/* AI Feature Carousel */}
        <div className="space-y-8">
          <h1 className="text-4xl font-black text-white">
            {AI_FEATURES[aiFeature].title}
          </h1>
          <p className="text-lg text-indigo-100">
            {AI_FEATURES[aiFeature].description}
          </p>
          <div className="pt-4 border-t border-indigo-400/30">
            {/* Feature-specific content */}
            <AIFeatureCard feature={AI_FEATURES[aiFeature]} />
          </div>
        </div>

        {/* Live Statistics */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Questions" value={stats.totalQuestions} />
            <StatCard label="Students" value={stats.totalStudents} />
            <StatCard label="Colleges" value={stats.totalColleges} />
            <StatCard label="Readiness" value={stats.avgReadiness} suffix="%" />
          </div>
        )}

        {/* AI News Feed */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wider">
            Today's AI Update
          </h3>
          <AINewsFeed />
        </div>

        {/* AI Tip of the Day */}
        <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-2xl p-4">
          <p className="text-xs font-bold text-indigo-200 uppercase mb-2">
            Today's Tip
          </p>
          <p className="text-sm text-white leading-relaxed">
            {getTodaysTip()}
          </p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="w-1/2 bg-white p-12 flex items-center justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
```

**Effort**: 12-15 hours

---

#### Task 2: College Branding System

**File**: `server/src/services/collegeBranding.service.ts` (NEW)

```typescript
export interface CollegeBranding {
  college_id: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  name: string;
  tagline: string;
  email_domain: string;
}

export async function getBrandingForDomain(emailDomain: string): Promise<CollegeBranding> {
  return db.college.findFirst({
    where: { email_domain: emailDomain },
    select: {
      id: true,
      name: true,
      logo: true,
      primary_color: true,
      email_domain: true,
    },
  });
}
```

**File**: `client/src/contexts/BrandingContext.tsx` (NEW)

```typescript
export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState<CollegeBranding>(DEFAULT_BRANDING);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.college_id) {
      fetchBrandingByCollege(user.college_id).then(setBranding);
    }
  }, [user]);

  // Apply branding dynamically
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', branding.primary_color);
    document.documentElement.style.setProperty('--secondary', branding.secondary_color);
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};
```

**Effort**: 8-10 hours

---

### Deployment Configuration

**File**: `docker-compose.prod.yml` (MODIFY)

```yaml
version: '3.9'
services:
  # Separate apps per domain
  admin-portal:
    image: talentsecure:admin-portal
    ports:
      - "5173:5173"
    environment:
      VITE_PORTAL_TYPE: super-admin
      VITE_API_URL: ${API_URL}

  college-portal:
    image: talentsecure:college-portal
    ports:
      - "5174:5173"
    environment:
      VITE_PORTAL_TYPE: college-admin
      VITE_API_URL: ${API_URL}

  student-portal:
    image: talentsecure:student-portal
    ports:
      - "5175:5173"
    environment:
      VITE_PORTAL_TYPE: student
      VITE_API_URL: ${API_URL}

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
```

**File**: `nginx.conf` (NEW)

```nginx
upstream admin_portal {
  server admin-portal:5173;
}

upstream college_portal {
  server college-portal:5173;
}

upstream student_portal {
  server student-portal:5173;
}

server {
  listen 443 ssl http2;
  ssl_certificate /etc/nginx/ssl/gradlogic.ai.crt;
  ssl_certificate_key /etc/nginx/ssl/gradlogic.ai.key;

  # Admin portal
  server_name admin.gradlogic.ai;
  location / {
    proxy_pass http://admin_portal;
    proxy_set_header Host $host;
  }
}

server {
  listen 443 ssl http2;
  server_name portal.gradlogic.ai;
  location / {
    proxy_pass http://college_portal;
    proxy_set_header Host $host;
  }
}

server {
  listen 443 ssl http2;
  server_name student.gradlogic.ai;
  location / {
    proxy_pass http://student_portal;
    proxy_set_header Host $host;
  }
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name _;
  return 301 https://$host$request_uri;
}
```

**Effort**: 4-6 hours

---

## Phase 2: White-Label Multi-Tenancy (2-3 weeks)

### Implementation Timeline

**Week 1**: College Subdomain Support
- Enable `kpriet.gradlogic.ai` routing
- Per-college theme customization
- College-specific logo/colors

**Week 2**: Custom Domain Support
- Enable `placement.kpriet.edu` support
- Custom email domains
- SSL certificate automation

**Week 3**: Analytics & Reporting
- Per-college analytics
- College-specific metrics
- Admin dashboard updates

---

## Development Checklist: Phase 1

### Backend (Server)
- [ ] Email-based role detection system
- [ ] College domain configuration
- [ ] Branding API endpoints
- [ ] Auth middleware updates
- [ ] Database migrations (email_domain field)

### Frontend (Client)
- [ ] Portal config system
- [ ] Remove role selector from login
- [ ] Post-login routing logic
- [ ] Enhanced login page with carousel
- [ ] College branding context
- [ ] Dynamic stats/news feed
- [ ] Theme system (CSS variables)

### Infrastructure
- [ ] Domain registration
- [ ] DNS configuration
- [ ] SSL certificates
- [ ] Nginx reverse proxy
- [ ] Environment variable setup
- [ ] Docker compose updates

### Testing
- [ ] Auth flow tests (3 domains)
- [ ] Role detection tests
- [ ] Branding tests
- [ ] E2E tests on each domain
- [ ] Mobile responsiveness on each portal

### Deployment
- [ ] Staging environment setup
- [ ] Production domain setup
- [ ] CI/CD pipeline updates
- [ ] Database migration scripts
- [ ] Rollback procedures

---

## Effort Estimation

| Component | Effort | Timeline |
|-----------|--------|----------|
| Infrastructure setup | 4-6h | Week 1 |
| Role detection system | 8-10h | Week 2 |
| Domain routing | 6-8h | Week 2 |
| Enhanced login page | 12-15h | Week 3 |
| College branding | 8-10h | Week 3 |
| Testing & QA | 10-12h | Week 4 |
| Deployment | 4-6h | Week 4 |
| **Total** | **52-67h** | **4 weeks** |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| DNS propagation delays | 🟡 Medium | Set low TTL (300s) in advance |
| SSL certificate issues | 🔴 High | Use Certbot auto-renewal, test staging first |
| Session/cookie cross-domain | 🔴 High | Use API tokens instead of cookies for auth |
| Existing users on old domain | 🟡 Medium | Set up 301 redirects for 6 months |
| Mobile responsiveness on 3 portals | 🟡 Medium | Use shared component library, test all 3 |

---

## Success Metrics

✅ **Phase 1 Complete When**:
- 3 domains fully operational
- Auto-role detection 100% accurate
- College branding loads correctly
- All E2E tests pass on all 3 domains
- Login page displays dynamic content
- Mobile works on all portals
- Zero cross-domain auth issues

✅ **User Experience Improvements**:
- Login time reduced by 30% (no role selector)
- College admins see branded portal
- Students see personalized dashboard
- Better security isolation per portal

---

## Next Steps

1. **Immediate (This Week)**
   - [ ] Get domains registered
   - [ ] Plan infrastructure with DevOps
   - [ ] Create Jira/Linear tickets for Phase 1
   - [ ] Review DNS/SSL approach

2. **Week 1**
   - [ ] Set up DNS, SSL, Nginx
   - [ ] Create staging domains
   - [ ] Test local multi-domain setup

3. **Week 2**
   - [ ] Implement role detection
   - [ ] Update auth system
   - [ ] Begin portal routing

4. **Week 3-4**
   - [ ] Enhanced login page
   - [ ] College branding
   - [ ] Full testing
   - [ ] Production deployment

---

## Code Repository Structure

```
talentsecure-ai/
├── client/
│  ├── src/
│  │  ├── config/
│  │  │  └── portalConfig.ts (NEW)
│  │  ├── contexts/
│  │  │  └── BrandingContext.tsx (NEW)
│  │  ├── pages/auth/
│  │  │  └── EnhancedLoginPage.tsx (NEW)
│  │  ├── hooks/
│  │  │  └── useAuthRedirect.ts (NEW)
│  │  └── App.tsx (MODIFY)
│  └── .env.admin, .env.college, .env.student (NEW)
├── server/
│  ├── src/
│  │  ├── auth/
│  │  │  └── roleDetection.ts (NEW)
│  │  ├── services/
│  │  │  └── collegeBranding.service.ts (NEW)
│  │  └── middleware/
│  │     └── portalAuth.ts (MODIFY)
│  └── migrations/
│     └── add_email_domain_to_colleges.sql (NEW)
├── docker/
│  ├── nginx.conf (NEW)
│  └── docker-compose.prod.yml (MODIFY)
└── deployment/
   └── multi-domain-setup.md (NEW)
```

---

## Conclusion

This multi-domain architecture provides:
- 🎯 **Professional appearance** with separate branded portals
- 🔒 **Better security** through domain isolation
- 📊 **Improved SEO** with domain-specific content
- 🎨 **College customization** with branding system
- 🚀 **Foundation for white-label** enterprise sales
- ⚡ **Seamless UX** with automatic role detection

**Ready to proceed? Let's start with Week 1 infrastructure setup.**
