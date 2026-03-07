# Access Control — Features, Actions & Permissions

This document lists all features, actions, and buttons in the Factory Management app and which roles can access each.

## Roles

| Role | Description |
|------|-------------|
| **admin** | Full system access; manages branches, users, rates, and all other data |
| **finance** | Financial operations: payments, exports, analytics; cannot manage branches/users/rates |
| **hr** | HR operations: employees, style orders, work records; cannot manage branches/users/rates |
| **employee** | Users with `employeeId` linked to an Employee record; limited to own data and passbook |

---

## Navigation (Sidebar)

| Page | Admin | Finance | HR | Employee |
|------|-------|---------|-----|----------|
| Home | ✓ | ✓ | ✓ | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ |
| Profile | ✓ | ✓ | ✓ | ✓ |
| Branches | ✓ | — | — | — |
| Employees | ✓ | ✓ | ✓ | — |
| Users | ✓ | — | — | — |
| Audit Log | ✓ | — | — | — |
| Reports (incl. Style Analytics) | ✓ | ✓ | ✓ | — |
| Rate Master | ✓ | — | — | — |
| Style Orders | ✓ | ✓ | ✓ | — |
| Work Records | ✓ | ✓ | ✓ | ✓ (contractors only, own) |
| Payments | ✓ (submenu) | ✓ (submenu) | ✓ (submenu) | ✓ (single link to own records) |
| Passbook | — | — | — | ✓ (own only) |

---

## Features & Actions by Page

### Home (Dashboard)

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| Change date range (1/3/6 months) | ✓ | ✓ | ✓ | ✓ |
| Customize dashboard (show/hide widgets) | ✓ | ✓ | ✓ | ✓ |
| Overview stats | ✓ | ✓ | ✓ | ✓ |
| Employees widget | ✓ | ✓ | ✓ | ✓ |
| Branches widget | ✓ | ✓ | ✓ | ✓ |
| Style Orders widget | ✓ | ✓ | ✓ | ✓ |
| Style-wise chart | ✓ | ✓ | ✓ | ✓ |
| Style suggestions | ✓ | ✓ | ✓ | ✓ |
| Payments widget | ✓ | ✓ | ✓ | ✓ |
| Work Records widget | ✓ | ✓ | ✓ | ✓ |
| Payment trend chart | ✓ | ✓ | ✓ | ✓ |
| Work trend chart | ✓ | ✓ | ✓ | ✓ |
| Payment mode chart | ✓ | ✓ | ✓ | ✓ |
| Employee type chart | ✓ | ✓ | ✓ | ✓ |
| My Stats (employee) | — | — | — | ✓ |
| My Work Trend (employee) | — | — | — | ✓ |
| My Payment Trend (employee) | — | — | — | ✓ |
| Birthdays & Anniversaries | ✓ (all) | ✓ (all) | ✓ (all) | ✓ (same branch only) |

---

### Profile

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View profile | ✓ | ✓ | ✓ | ✓ |
| Edit own profile (name, contact, bank, etc.) | — | — | — | ✓ |
| Upload profile photo | — | — | — | ✓ |

*Note: Admin/Finance/HR without `employeeId` see user info only; no editable profile.*

---

### Branches

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View branches list | ✓ | — | — | — |
| Add branch | ✓ | — | — | — |
| Edit branch | ✓ | — | — | — |
| View branch details | ✓ | — | — | — |
| Make branch active/inactive | ✓ | — | — | — |
| Include inactive branches filter | ✓ | — | — | — |

*Note: Branches page is hidden from Finance/HR in nav. API GET allows admin/finance/hr for dropdown usage elsewhere.*

---

### Employees

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View employees list | ✓ | ✓ | ✓ | — |
| Add employee | ✓ | ✓ | ✓ | — |
| Edit employee | ✓ | ✓ | ✓ | — |
| View employee details | ✓ | ✓ | ✓ | — |
| Create user for employee (any role) | ✓ | — | — | — |
| Create user for employee (employee role only) | — | ✓ | ✓ | — |
| Generate password (on create user) | ✓ | ✓ | ✓ | — |
| Upload employee photo | ✓ | ✓ | ✓ | — |
| Include inactive employees filter | ✓ | ✓ | ✓ | — |

---

### Users

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View users list | ✓ | — | — | — |
| Add user (admin or employee) | ✓ | — | — | — |
| Edit user (email, password, role, isActive) | ✓ | — | — | — |
| View user details | ✓ | — | — | — |
| Generate password (on create) | ✓ | — | — | — |
| Filter by role / employee type | ✓ | — | — | — |

---

### Rate Master

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View rates list | ✓ | — | — | — |
| Add rate | ✓ | — | — | — |
| Edit rate | ✓ | — | — | — |
| View rate details | ✓ | — | — | — |
| Import from Excel | ✓ | — | — | — |
| Download import template | ✓ | — | — | — |
| Include inactive rates filter | ✓ | — | — | — |

*Note: Rates API GET allows employees (for work records context) but Rate Master page is admin-only.*

---

### Style Orders

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View style orders list | ✓ | ✓ | ✓ | — |
| Add style order | ✓ | ✓ | ✓ | — |
| Edit style order | ✓ | ✓ | ✓ | — |
| View style order details | ✓ | ✓ | ✓ | — |
| Filter by branch / month | ✓ | ✓ | ✓ | — |

---

### Work Records

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View all work records | ✓ | ✓ | ✓ | — |
| View own work records | — | — | — | ✓ |
| Add work record | ✓ | ✓ | ✓ | ✓ (own only) |
| Edit work record | ✓ | ✓ | ✓ | ✓ (own only) |
| Delete work record | ✓ | ✓ | ✓ | ✓ (own only) |
| Filter by employee / branch / month | ✓ | ✓ | ✓ | — |

---

### Payments (Contractors & Full-time)

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View all payments | ✓ | ✓ | ✓ | — |
| View own payments | — | — | — | ✓ |
| Add payment | ✓ | ✓ | — | — |
| Add advance payment | ✓ | ✓ | — | — |
| Export for Bank Transfer (CSV/Excel) | ✓ | ✓ | — | — |
| Filter by employee / month / advance | ✓ | ✓ | ✓ | — |
| Filter by advance (contractors) | ✓ | ✓ | ✓ | ✓ |

---

### Style Orders Analytics

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View analytics page | ✓ | ✓ | ✓ | ✓* |
| View selling price & profit/loss | ✓ | — | — | — |
| View limited data (no selling price/profit) | — | ✓ | ✓ | ✓* |
| Export to Excel | ✓ | ✓ | ✓ | ✓* |
| Filter by branch / month | ✓ | ✓ | ✓ | ✓* |

*Note: Nav shows Analytics for employees, but `/api/style-orders/analytics` returns 403 for non-admin/finance/hr. Employees may see the page but data fetch will fail.*

---

### Passbook

| Feature / Action | Admin | Finance | HR | Employee |
|------------------|-------|---------|-----|----------|
| View own passbook | — | — | — | ✓ |
| View any employee passbook | ✓ | ✓ | ✓ | — |

*Note: Passbook nav link is shown only to employees (own). Admin/Finance/HR access passbook via employee detail or direct URL.*

---

## API-Level Access Summary

| API | GET | POST | PATCH | DELETE |
|-----|-----|------|-------|--------|
| `/api/branches` | admin, finance, hr | admin | — | — |
| `/api/branches/[id]` | admin | — | admin | — |
| `/api/employees` | admin, finance, hr | admin, finance, hr | — | — |
| `/api/employees/[id]` | admin, finance, hr, or own | — | admin, finance, hr, or own | — |
| `/api/employees/[id]/photo` | — | admin, finance, hr | — | — |
| `/api/employees/[id]/passbook` | admin, finance, hr, or own | — | — | — |
| `/api/users` | admin | admin | — | — |
| `/api/users/[id]` | — | — | admin | — |
| `/api/rates` | admin, finance, hr, employee | admin | — | — |
| `/api/rates/[id]` | admin | — | admin | — |
| `/api/rates/import-template` | admin | — | — | — |
| `/api/style-orders` | admin, finance, hr | admin, finance, hr | — | — |
| `/api/style-orders/[id]` | admin, finance, hr | — | admin, finance, hr | admin, finance, hr |
| `/api/style-orders/analytics` | admin, finance, hr | — | — | — |
| `/api/work-records` | admin, finance, hr, or own | admin, finance, hr, or own | — | — |
| `/api/work-records/[id]` | admin, finance, hr, or own | — | admin, finance, hr, or own | admin, finance, hr, or own |
| `/api/payments` | admin, finance, hr, or own | admin, finance | — | — |
| `/api/payments/export` | admin, finance | — | — | — |
| `/api/payments/calculate` | admin, finance, hr, or own | — | — | — |
| `/api/payments/last-paid` | admin, finance, hr, or own | — | — | — |
| `/api/payments/advance-outstanding` | admin, finance, hr | — | — | — |
| `/api/dashboard/stats` | admin, finance, hr, employee | — | — | — |
| `/api/profile` | any logged-in | — | — | — |
| `/api/profile/photo` | — | any logged-in (own) | — | — |

---

## Notes

1. **Employee role**: A user with `employeeId` is treated as an employee regardless of `role` for access to own data (work records, payments, passbook).
2. **Create user from employee**: Admin can assign any role (admin, finance, hr, employee); Finance/HR can only assign employee role.
3. **Export for Bank Transfer**: Only Admin and Finance can export payments in bank transfer format (NEFT/IMPS).
4. **Style Analytics**: Admin sees selling price and profit/loss; Finance/HR see manufacturing cost and produced quantity only.
5. **Branches page**: Nav shows Branches only to Admin; API GET allows Finance/HR for dropdowns in other pages.
