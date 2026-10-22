# MiniLedger 📱💰

MiniLedger is a full-stack personal finance mobile application for tracking money lent to friends and family. It features real-time financial summaries, overdue loan highlighting, mock phone OTP authentication, and an Express + PostgreSQL backend powered by Prisma.

---

## 📑 Table of Contents
1. [Features](#features)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Folder Structure](#folder-structure)
4. [Financial Calculations & Definitions](#financial-calculations--definitions)
5. [Prerequisites](#prerequisites)
6. [Quick Start Guide](#quick-start-guide)
   - [Step 1: Installation](#step-1-installation)
   - [Step 2: Database Setup & Migrations](#step-2-database-setup--migrations)
   - [Step 3: Start the Backend Server](#step-3-start-the-backend-server)
   - [Step 4: Start the Expo Mobile App](#step-4-start-the-expo-mobile-app)
7. [How to Run on Android Phone (Expo Go)](#how-to-run-on-android-phone-expo-go)
8. [Mock Phone OTP Authentication Guide](#mock-phone-otp-authentication-guide)
9. [Running Automated Tests](#running-automated-tests)
10. [API Reference](#api-reference)
11. [Environment Variables & Security Notes](#environment-variables--security-notes)
12. [Known Limitations](#known-limitations)

---

## ✨ Features

- **Phone OTP Login**: Passwordless phone number authentication with 6-digit verification codes printed in the backend terminal.
- **Financial Dashboard**:
  - **Total Lent Card**: Aggregates all original loan amounts.
  - **Total Repaid Card**: Tracks recovered funds.
  - **Overdue Card**: Highlights money past its repayment due date.
- **Smart Loan Management**:
  - Add loans with friend name, positive decimal amount, due date, and optional notes.
  - Quick-preset due dates (+7 days, +14 days, +30 days, or custom calendar date).
  - Filter loans by **All**, **Pending**, **Repaid**, and **Overdue**.
  - **Red Alert Highlighting**: Overdue unpaid loans are accented with red border indicators and warning badges.
  - **Mark as Repaid Action**: One-tap repayment with confirmation prompt and immutable repayment timestamp (`repaidAt`). Duplicate repayments are strictly prevented.
- **Pull-to-Refresh**: Seamless live synchronization of loans and summary cards.
- **Server Switcher**: In-app configuration modal to toggle between LAN IP (`192.168.1.34`), Android Emulator (`10.0.2.2`), and Localhost (`127.0.0.1`).
- **Strict User Isolation**: Users only ever access and modify their own loan records.

---

## 🛠️ Tech Stack & Architecture

- **Mobile App**:
  - **Framework**: React Native with [Expo](https://expo.dev/) (TypeScript)
  - **State & Storage**: React Context + `expo-secure-store` / `@react-native-async-storage/async-storage`
  - **Design**: Clean, modern finance dashboard with card elevation, accessible typography, and status badges.
- **Backend API**:
  - **Runtime**: Node.js (v24 compatible) + Express (TypeScript)
  - **Database ORM**: [Prisma](https://www.prisma.io/)
  - **Database Engine**: PostgreSQL with `DECIMAL(12, 2)` monetary columns
  - **Validation**: [Zod](https://zod.dev/) schema validation on all inputs
  - **Authentication**: Signed JSON Web Tokens (JWT) with configurable expiration
  - **Local Zero-Setup Database**: Embedded PostgreSQL runner (`node scripts/start-local-db.js`)
- **Automated Testing**:
  - **Framework**: Jest + Supertest (covering auth, validation, loan CRUD, double repayment prevention, user isolation, and metrics calculation).

---

## 📁 Folder Structure

```text
MiniLedger/
├── package.json                 # Monorepo root scripts & npm workspaces
├── .gitignore                   # Git ignore file (excludes secrets, .env, DB data)
├── README.md                    # Full documentation & setup guide
├── apps/
│   ├── api/                     # Express TypeScript Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # PostgreSQL database schema (User, Loan, OtpCode)
│   │   │   └── migrations/      # Prisma migration files
│   │   ├── scripts/
│   │   │   └── start-local-db.js # Embedded PostgreSQL server runner
│   │   ├── src/
│   │   │   ├── config/env.ts    # Zod-validated environment config
│   │   │   ├── db/prisma.ts     # Prisma singleton client
│   │   │   ├── middleware/      # auth, request validation, error handler
│   │   │   ├── routes/          # auth and loan endpoints
│   │   │   ├── services/        # OTP generation and Loan business logic
│   │   │   ├── app.ts           # Express application setup
│   │   │   └── index.ts         # Server entry point
│   │   ├── tests/               # Automated Jest integration tests
│   │   ├── .env.example         # Template for environment variables
│   │   └── tsconfig.json        # TypeScript configuration
│   │
│   └── mobile/                  # React Native Expo Application
│       ├── app.json             # Expo configuration (name, slug, splash)
│       ├── App.tsx              # Root component & navigation switch
│       ├── src/
│       │   ├── components/      # SummaryCard, LoanCard, AddLoanModal, ServerConfigModal
│       │   ├── context/         # AuthContext (login, logout, token state)
│       │   ├── screens/         # LoginScreen, OtpScreen, DashboardScreen
│       │   ├── services/        # HTTP client (api.ts) & storage.ts
│       │   └── types/           # TypeScript data interfaces
│       └── tsconfig.json        # Mobile TypeScript configuration
```

---

## 📊 Financial Calculations & Definitions

The summary API (`GET /api/loans/summary`) returns three financial aggregates computed on the authenticated user's loans:

1. **Total Lent**:
   $$\text{Total Lent} = \sum_{\text{all loans}} \text{amount}$$
   The sum of original amounts of every loan created by the user.

2. **Total Repaid**:
   $$\text{Total Repaid} = \sum_{\text{loans where } \text{isRepaid} = \text{true}} \text{amount}$$
   The sum of amounts for all loans that have been successfully marked as repaid.

3. **Overdue Amount**:
   $$\text{Overdue Amount} = \sum_{\substack{\text{loans where } \text{isRepaid} = \text{false} \\ \text{and } \text{dueDate} < \text{current timestamp}}} \text{amount}$$
   The sum of unpaid loan amounts whose scheduled due date is strictly in the past.

---

## ⚙️ Prerequisites

1. **Node.js**: v20 or newer (v24.12.0 verified).
2. **npm**: v10 or newer (v11.4.1 verified).
3. **Expo Go app** on your Android phone (available free from Google Play Store).
4. Both your Windows computer and Android phone must be connected to the **same Wi-Fi local network**.

---

## 🚀 Quick Start Guide

### Step 1: Installation

Open PowerShell or Command Prompt at the project root (`MiniLedger`):

```bash
# Install root dependencies
npm install

# Install API backend dependencies
cd apps/api
npm install

# Install Mobile dependencies
cd ../mobile
npm install
cd ../..
```

---

### Step 2: Database Setup & Migrations

MiniLedger includes an **embedded PostgreSQL runner** that requires no pre-installed PostgreSQL server on Windows.

1. **Start the local PostgreSQL database**:
   In a separate terminal window:
   ```bash
   npm run db:start
   ```
   *This starts native PostgreSQL on port `5433` and creates the `miniledger` database automatically.*

   > **Note**: If you already have an external PostgreSQL instance (Docker, Supabase, Neon, or local PostgreSQL on port 5432), simply adjust the `DATABASE_URL` in `apps/api/.env` to point to it!

2. **Apply Prisma migrations**:
   In your main terminal:
   ```bash
   npm run db:migrate
   ```
   *This creates the `users`, `loans`, and `otp_codes` tables in PostgreSQL.*

---

### Step 3: Start the Backend Server

In a new terminal:
```bash
npm run dev:api
```

The backend server starts on `http://localhost:4000` (or `http://192.168.1.34:4000` on your local network).
Verify it by opening `http://localhost:4000/api/health` in your browser.

---

### Step 4: Start the Expo Mobile App

In another terminal:
```bash
npm run dev:mobile
```

Metro Bundler will launch and display a **QR code** in your terminal.

---

## 📲 How to Run on Android Phone (Expo Go)

1. **Install Expo Go**:
   Download and install the **Expo Go** app from the Google Play Store on your Android phone.

2. **Connect to Same Wi-Fi**:
   Ensure your Android phone and Windows computer are on the same Wi-Fi network.

3. **Verify Computer IP**:
   Open a terminal and run `ipconfig`. Look for your Wi-Fi IPv4 address (e.g., `192.168.1.34`).
   - The app's default server URL is configured to:
     `http://192.168.1.34:4000`

4. **Scan QR Code**:
   - Open the **Expo Go** app on your phone.
   - Tap **"Scan QR code"** and point your camera at the QR code displayed in the Expo terminal.
   - Expo Go will download the JavaScript bundle and render MiniLedger!

5. **In-App Server Config**:
   If your Wi-Fi IP address changes:
   - On the login screen or top-right gear icon `⚙️` on the dashboard, tap **"Change Server URL"**.
   - Enter your computer's IP and port (e.g., `http://192.168.1.XX:4000`) and tap **Save URL**.

---

## 🔑 Mock Phone OTP Authentication Guide

MiniLedger uses a developer-friendly **mock phone OTP** mechanism:

1. On the login screen, enter any phone number (e.g., `+1 555-123-4567` or `+91 9876543210`).
2. Tap **"Send OTP Code"**.
3. **Switch to your computer terminal** running `npm run dev:api` (or `node dist/index.js`).
4. You will see a prominent highlighted block printed in the console:
   ```text
   ========================================================
    [MOCK OTP SERVICE] Verification Code
    Phone Number: +15551234567
    Code:         >>> 482910 <<<
    Valid for:    5 minutes
    Note: Local mock authentication (check server terminal)
   ========================================================
   ```
5. Enter the 6-digit code on the phone screen and tap **"Verify & Enter"**.
6. The server validates the code, marks it consumed, issues a signed JWT token, and logs you into the dashboard.

> [!IMPORTANT]
> - OTPs expire automatically after **5 minutes**.
> - Each OTP allows a maximum of **3 attempts** before being invalidated.
> - Once verified, an OTP is marked as consumed and **cannot be reused**.
> - In standard configuration, the OTP code is **never returned in the API response** to prevent client leaks.

---

## 🧪 Running Automated Tests

MiniLedger includes an automated integration test suite in `apps/api/tests`:

```bash
# Run tests from the root directory
npm test

# Or run tests directly inside apps/api
cd apps/api
npm test
```

### Test Coverage Highlights
- ✅ **OTP Generation**: Verifies 6-digit generation, database persistence, and absence from HTTP response bodies.
- ✅ **OTP Verification**: Validates correct codes, rejects expired codes, enforces 3-attempt limits, and blocks token reuse.
- ✅ **Input Validation**: Rejects negative/zero loan amounts, missing friend names, and invalid date formats.
- ✅ **Loan Lifecycle**: Tests loan creation, authenticated listing, and repayment timestamps.
- ✅ **Double Repayment Guard**: Strictly rejects multiple repayment calls with `400 Bad Request`.
- ✅ **User Isolation**: Verifies that User B cannot read or mark User A's loans.
- ✅ **Summary Calculations**: Tests exact calculations for `totalLent`, `totalRepaid`, and `overdueAmount` across active, repaid, and overdue loans.

---

## 🌐 API Reference

All requests accept and return JSON. Endpoints marked 🔒 require an `Authorization: Bearer <token>` header.

### Authentication Endpoints

#### 1. Send OTP
- **`POST /api/auth/otp/send`**
- **Request Body**:
  ```json
  {
    "phoneNumber": "+15551234567"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "OTP generated. Please check the backend terminal for your 6-digit code."
  }
  ```

#### 2. Verify OTP
- **`POST /api/auth/otp/verify`**
- **Request Body**:
  ```json
  {
    "phoneNumber": "+15551234567",
    "code": "482910"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Authentication successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "cmv...",
      "phoneNumber": "+15551234567"
    }
  }
  ```

---

### Loan Endpoints (🔒 Protected)

#### 3. Get Financial Summary
- **`GET /api/loans/summary`**
- **Response `200 OK`**:
  ```json
  {
    "totalLent": 450.00,
    "totalRepaid": 150.00,
    "overdueAmount": 100.00
  }
  ```

#### 4. List Loans
- **`GET /api/loans`**
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "loan_1",
      "userId": "user_1",
      "friendName": "Sarah",
      "amount": 100.00,
      "dueDate": "2026-10-15T00:00:00.000Z",
      "notes": "Concert ticket",
      "isRepaid": false,
      "repaidAt": null,
      "createdAt": "2026-10-10T12:00:00.000Z",
      "updatedAt": "2026-10-10T12:00:00.000Z"
    }
  ]
  ```

#### 5. Create Loan
- **`POST /api/loans`**
- **Request Body**:
  ```json
  {
    "friendName": "Michael",
    "amount": 75.50,
    "dueDate": "2026-11-05T00:00:00.000Z",
    "notes": "Dinner split"
  }
  ```
- **Response `201 Created`**: Returns created loan object.

#### 6. Mark Loan as Repaid
- **`PATCH /api/loans/:id/repay`**
- **Response `200 OK`**: Returns updated loan with `isRepaid: true` and `repaidAt` timestamp.
- **Error `400 Bad Request`**: If already repaid (`"This loan has already been marked as repaid."`).
- **Error `404 Not Found`**: If the loan does not exist or belongs to another user.

---

## 🔒 Environment Variables & Security Notes

- **Secrets Handling**: `.env` is ignored by `.gitignore`. Never commit actual `.env` files or production keys.
- **`apps/api/.env.example`** defines all expected configuration variables:
  ```env
  PORT=4000
  NODE_ENV=development
  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/miniledger?schema=public"
  JWT_SECRET="replace_with_a_secure_random_string_in_production"
  JWT_EXPIRES_IN="7d"
  OTP_EXPIRY_MINUTES=5
  OTP_MAX_ATTEMPTS=3
  LOCAL_DB_PORT=5433
  ```
- **Monetary Precision**: Loan amounts are stored in PostgreSQL using `DECIMAL(12, 2)` to eliminate IEEE floating-point rounding errors.
- **User Isolation**: All queries filter by `userId` extracted securely from the verified JWT payload.

---

## ⚠️ Known Limitations

1. **Mock Authentication**: OTP codes are logged to the backend terminal for local evaluation. For production deployment, integrate an SMS gateway provider (such as Twilio, AWS SNS, or Firebase Auth).
2. **Wi-Fi Isolation on Some Public Networks**: Some guest or campus Wi-Fi networks block peer-to-peer traffic between devices. If Expo Go cannot connect to your PC, ensure your Windows firewall permits port `4000` (Node API) and `8081` (Expo Metro), or connect both devices to a mobile phone hotspot.
