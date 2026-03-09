# URBAN FASHION FACTORY (UFF)

A comprehensive Next.js application for managing URBAN FASHION FACTORY with multiple outlets, staff, and payment tracking.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **MongoDB** + Mongoose
- **Tailwind CSS**
- **TypeScript**

## Features

- **Authentication**: Login with email/password, forgot password, role-based access (Admin, Finance, Accountancy, HR, Employee)
- **Localization**: English, Kannada, Hindi
- **Accessibility**: Adjustable font sizes (12px–24px)
- **Branches**: CRUD for URBAN FASHION FACTORY branches (Admin only)
- **Employees**: Full employee management with user access creation, branch tagging, full-time/contractor types
- **Profile**: View and edit personal details (name, contact, emergency number)
- **Responsive**: Works on all screen sizes

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set:
   - `MONGODB_URI` – MongoDB connection string
   - `JWT_SECRET` – Secret for JWT tokens
   - `MINIMUM_WAGES` – (Optional) Minimum wages per day in ₹ for accountancy compliance; default 500

3. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

4. **Seed admin user + dummy data**
   ```bash
   npm run seed
   ```
   Creates admin user and sample data (branches, employees, rates, work records, payments).
   **Admin credentials:** `admin@uff.com` / `Admin@123`

   To add more dummy data (rates, work records, payments) to an existing DB:
   ```bash
   npm run seed:dummy
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Role Permissions

| Feature      | Admin | Finance | Accountancy | HR | Employee |
|-------------|-------|---------|-------------|-----|----------|
| Branches    | ✓     | ✗       | ✗           | ✗   | ✗        |
| Employees   | ✓ (any role) | ✓ (employee only) | ✓ (read-only) | ✓ (employee only) | ✗ |
| Profile     | ✓     | ✓       | ✓           | ✓   | ✓        |
| Home        | ✓     | ✓       | ✓           | ✓   | ✓        |

*Accountancy: Same view as Finance but read-only; sees virtual days attended for full-time salary (compliance with minimum wages).*

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Authenticated routes
│   │   ├── branches/
│   │   ├── employees/
│   │   ├── profile/
│   │   └── page.tsx     # Home
│   ├── api/             # API routes
│   │   ├── auth/
│   │   ├── branches/
│   │   ├── employees/
│   │   └── profile/
│   └── login/
├── components/
├── contexts/
├── lib/
│   ├── models/
│   └── ...
└── ...
```

## Notes

- Password reset uses in-memory OTP storage (dev). Use Redis for production.

**MongoDB connection refused?** Ensure MongoDB is running locally (`mongod` or `sudo systemctl start mongod`) or set `MONGODB_URI` in `.env.local` to a MongoDB Atlas connection string.

**Invalid credentials with admin@uff.com?** Run `npm run seed` to create the admin user (and dummy data), or `npm run seed:admin` to create/reset only the admin: `admin@uff.com` / `Admin@123`
- When an employee is disabled, their login is also disabled.
- Employee creation auto-generates a user account with a random password (shown once in a modal).


Email	admin@uff.com
Password	Admin@123
