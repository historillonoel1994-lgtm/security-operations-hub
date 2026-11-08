# Security Operations Hub (SOH)
### Corporate Security Command & Field Task Follow-up System (Philippines)

A purpose-built, lightweight web application designed for a **Corporate Security Manager** overseeing regional security supervisors, investigators, and field security personnel across offices, data centers, warehouses, and Security Operations Centers (SOCs) throughout the Philippines.

---

## 1. The Productivity Problem (W–H Framework)
* **What?** The Security Manager oversees dozens of simultaneous physical inspections, access control audits, CCTV blindspot checks, cargo discrepancy investigations, and vendor accreditations. It is difficult to track which tasks are assigned, pending, overdue, or awaiting manager sign-off.
* **Where?** Facilities across the Philippines, including Metro Manila (Taguig Data Center, Makati SOC, BGC Head Office), Region III (Clark Logistics Hub), Region IV-A (Santa Rosa Warehouse, Laguna Technopark), and Region VII (Cebu IT Park Hub).
* **When?** Every working day, especially as shift turn-over logs, incident reports, and vendor follow-ups arrive asynchronously.
* **Why?** Crucial security task details are scattered across emails, chat messages, manual logbooks, and paper manifests. Managers spend hours asking for routine status updates.
* **How handled currently?** Manual spreadsheet tracking, back-and-forth emails, and memory.
* **Solution (SOH):** A single corporate command board answering five simple questions:
  1. *What needs action?*
  2. *Who is assigned?*
  3. *When is it due (Philippine Time)?*
  4. *What progress has been submitted?*
  5. *What requires managerial approval?*

---

## 2. Alternatives Comparison & Selection Rationale
| Criteria | Generic Spreadsheets (Excel / Google Sheets) | Complex Enterprise Task Trackers (Jira / Asana) | Security Operations Hub (SOH - Selected) |
| :--- | :--- | :--- | :--- |
| **Field Simplicity** | High clutter; accidental row overwriting; poor mobile entry. | Overcomplicated with story points, agile sprints, and heavy features. | **High:** 4 focused tabs, clean mobile cards, minimal clicks. |
| **Access Control (RBAC)** | Cell protections are fragile; anyone with link can view all facilities. | Requires paid enterprise licenses per user; steep learning curve. | **Strict:** Zero-trust; pending approvals; field supervisors only see their assigned tasks. |
| **Workflow Integrity** | Anyone can mark a row "Done" without proof or review. | Complex workflow transition setup. | **Built-in lifecycle:** `Assigned -> In Progress -> For Review -> Completed` (only Manager can close). |
| **Audit Trail** | Weak change tracking. | Cluttered revision histories. | **Tamper-resistant:** Full chronological task updates & audit log. |

**Decision:** The lightweight SOH is selected because it meets strict corporate security requirements while remaining simple enough for field supervisors and investigators to use without specialized technical training.

---

## 3. Four Core Pages (Scope & Simplicity)
1. **Dashboard:**
   - 5 small summary cards: *Active Tasks*, *Due Today*, *Overdue*, *For Review*, and *Completed*.
   - Compact department work table with status, priority, Philippine local due date, and quick filters.
   - Primary `+ Create Task` button (exclusive to Managers).
2. **Tasks:**
   - Manager task assignment form (Title, Instructions, Category, Assignee, Region, Due Date, Priority, Remarks).
   - Real task lifecycle: `Assigned -> In Progress -> For Review -> Completed` (or `Returned for Revision`).
   - Chronological update history with author, timestamp, % complete, and manager feedback.
3. **Daily Activities:**
   - Quick shift log entry: Activity Date, Title, Accomplishment Description, Facility Site, Linked Task, Remarks.
   - Field personnel view their own shift logs; Manager reviews authorized regional logs.
4. **Reports:**
   - Date range selector with presets (*Today*, *This Week*, *This Month*, *All Time*).
   - Generates summaries from actual database records (Daily Activities, Accomplishments, Pending, Overdue, Completed).
   - One-click **CSV Export** for tasks and activities.
   - **Print-Friendly Report View** formatted for official filing and signatures.
   - Optional **AI-Drafted Executive Briefing** (clearly marked as requiring manager review).

---

## 4. Architecture & Security Structure

```
├── .env.example                  # Environment configuration template (NO secrets)
├── index.html                    # HTML entry point with sync metadata
├── package.json                  # Dependencies (React 19, Vite, Tailwind CSS, Supabase JS)
├── supabase/
│   └── schema.sql                # Production PostgreSQL migration with RLS & triggers
├── public/
│   └── _redirects                # Netlify SPA routing fallback
└── src/
    ├── types/index.ts            # TypeScript data contracts
    ├── lib/
    │   ├── supabaseClient.ts     # Safe public client initialization
    │   ├── philippinesRegions.ts # Standard Philippine security facilities
    │   ├── dateUtils.ts          # Philippine Standard Time (Asia/Manila) utilities
    │   └── mockData.ts           # Visibly labeled fictional sample data for demo mode
    ├── context/
    │   ├── AuthContext.tsx       # Auth state, Google OAuth, approvals & demo personas
    │   └── DataContext.tsx       # Data store, RLS-like filtering, lifecycle transitions
    ├── components/
    │   ├── Navbar.tsx            # Corporate header, demo switcher, approvals badge
    │   ├── NavigationTabs.tsx    # 4 core page tabs
    │   ├── DashboardView.tsx     # Page 1: 5 summary cards, compact table, filters
    │   ├── TasksView.tsx         # Page 2: Tasks roster, status tabs, cards
    │   ├── ActivitiesView.tsx    # Page 3: Daily shift logs and accomplishments
    │   ├── ReportsView.tsx       # Page 4: Summaries, CSV export, AI draft helper
    │   ├── PrintReportView.tsx   # Formal printable layout with signature blocks
    │   ├── CreateTaskModal.tsx   # Manager task creation form
    │   ├── TaskDetailModal.tsx   # Lifecycle update & review drawer
    │   ├── CreateActivityModal.tsx # Daily shift accomplishment entry form
    │   ├── UserApprovalsModal.tsx# Manager user authorization panel
    │   ├── UserProfileModal.tsx  # Minimal account details and privacy notice
    │   ├── LoginView.tsx         # Google sign-in and demo persona switcher
    │   └── PendingApprovalScreen.tsx # Screen for unapproved user registrations
    ├── App.tsx                   # Main router and state coordinator
    └── main.tsx                  # Vite React root
```

---

## 5. Google Sign-In & Supabase Setup (Beginner-Friendly Guide)

### Step A: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, choose a project name (e.g., `soh-security-app`), and choose Singapore (`ap-southeast-1`) as the region for optimal latency to the Philippines.
3. Save your database password securely.

### Step B: Execute the SQL Migration
1. In your Supabase project dashboard, open the **SQL Editor** tab from the left sidebar.
2. Click **New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**.
3. This creates:
   - Tables: `profiles`, `tasks`, `task_updates`, `activities`, `audit_logs`
   - Constraints, indexes, and automatic triggers
   - Full **Row Level Security (RLS)** policies

### Step C: Enable Google OAuth in Supabase
1. In the Supabase dashboard, go to **Authentication** > **Providers** > **Google**.
2. Toggle Google to **Enabled**.
3. Create a Google Cloud OAuth Client ID:
   - Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
   - Create an OAuth 2.0 Client ID for a **Web Application**.
   - Under **Authorized redirect URIs**, copy and paste the **Callback URL** provided by Supabase (e.g., `https://<your-project-id>.supabase.co/auth/v1/callback`).
   - Copy the generated **Client ID** and **Client Secret** into your Supabase Google provider settings and click **Save**.

### Step D: Set Supabase URL Configuration
1. In Supabase, go to **Authentication** > **URL Configuration**.
2. In **Site URL**, enter your deployed application URL (e.g., `https://your-app.netlify.app` or your local development URL).
3. Under **Redirect URLs**, add:
   - `http://localhost:3000`
   - `https://your-app.netlify.app`

### Step E: Configure Environment Variables
Copy `.env.example` to `.env` (or configure in Netlify):
```bash
VITE_SUPABASE_URL="https://nngqluxokryfyggjysdi.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_seO9b8XhR_aHGBStSDEUSQ_rpOTUNiY"
VITE_SUPABASE_ANON_KEY="sb_publishable_seO9b8XhR_aHGBStSDEUSQ_rpOTUNiY"
```
> **Security Rule:** Never put the `service_role` secret in `.env` or frontend code! The application only needs the public publishable/anon key.

### Step E.1: Embedded Preview vs Standalone Browser (Google Error 403 Fix)
* **Why Google OAuth blocks iframes:** Google's identity servers return **Error 403 (`disallowed_useragent` / clickjacking protection)** whenever OAuth is attempted inside an embedded `<iframe>` (such as the Google AI Studio preview window).
* **Automatic Detection:** SOH detects whether it is running inside an embedded iframe via `isEmbeddedInIframe()`.
* **Safe Handling:** When embedded, SOH does not trigger OAuth inside the iframe. Instead, it displays a clear message with a direct link button: **"Open in Separate Browser Tab to Sign In"**.
* **Direct Browser Execution:** When opened directly in a browser tab (or deployed on Netlify), the standard **"Sign In with Google (Gmail)"** button initiates OAuth normally.

### Step F: Safe Manual First-Manager Bootstrap
Because new users are created as `member` with `approved = false`, run this one-time command in the Supabase SQL Editor after your first Google login:
```sql
UPDATE public.profiles
SET role = 'manager', approved = true, active = true
WHERE email = 'your.actual.gmail@gmail.com';
```

---

## 6. Netlify Deployment Guide

1. **Build Command:** `npm run build`
2. **Publish Directory:** `dist`
3. **SPA Redirect Rule:** Handled automatically by `public/_redirects` (`/*  /index.html  200`).
4. **Environment Variables on Netlify:**
   - Go to **Site Configuration** > **Environment variables**.
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Trigger deploy!

---

## 7. Test Matrix & Acceptance Criteria (Steps 1 – 15)

| Test Item | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- |
| **1. First-time Login Registration** | New user profile created with `approved = false` (Pending). | **PASS** | Verified via AuthContext and trigger schema. |
| **2. Pending User Data Isolation** | Unapproved account cannot view any tasks or shift logs. | **PASS** | `PendingApprovalScreen` blocks view; RLS denies access. |
| **3. Manager vs Member Scope** | Manager sees all department tasks; Member sees only their assignments. | **PASS** | Filtered by `assigned_to === user.id` in context & RLS. |
| **4. Manager Task Assignment** | Manager creates task with title, instructions, assignee, and due date. | **PASS** | Validates required fields; prevents missing info. |
| **5. Member Progress Update** | Member records notes, % slider, and submits for review. | **PASS** | Transitions task to `for_review` status. |
| **6. Task Completion Restrictions** | Member cannot directly mark task Completed; requires Manager approval. | **PASS** | UI and RLS strictly reserve approval to `manager`. |
| **7. Manager Revision / Return** | Manager returns task with feedback notes for personnel correction. | **PASS** | Task transitions to `returned` status. |
| **8. Philippine Time Overdue Computation** | Due date earlier than Philippine today flagged as Overdue automatically. | **PASS** | Uses `Asia/Manila` (UTC+8) date comparison. |
| **9. Session Logout Isolation** | Logging out immediately wipes authenticated UI and private task data. | **PASS** | `logout()` resets current user and clears memory. |
| **10. Browser Refresh Persistence** | Tasks and updates persist across page reloads. | **PASS** | Tested in local storage demo and Supabase queries. |
| **11. CSV Data Export** | Generates compliant CSV files with actual saved records. | **PASS** | Exports tasks and daily activities with complete headers. |
| **12. Print-Friendly Report** | Clean printable view formatted for official review. | **PASS** | High-contrast layout with signature sign-off blocks. |
| **13. AI Narrative Transparency** | AI executive summary explicitly flagged as AI-drafted. | **PASS** | Stamped with verification notice for Manager review. |
| **14. Live Netlify Deployment** | Live OAuth redirect on custom deployed Netlify domain. | **NOT TESTED** | Requires user's own live Netlify credentials & GitHub push. |

---

## 8. Privacy & Corporate Security Notice
This application strictly adheres to corporate data minimization:
* No government-issued IDs, residential addresses, personal phone numbers, or employee payroll details are requested.
* Fictional sample data is provided for academic demonstration and system evaluation.
* For official deployment in a production corporate environment, ensure institutional authorization and information security review.
