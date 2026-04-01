# Tenant Management System - Project Overview

## 📋 Project Description

The **Tenant Management System** is a comprehensive web application designed to help property managers and landlords efficiently manage their rental properties, tenants, payments, and related operations. The system provides a complete solution for tracking tenant information, processing rent payments, managing maintenance requests, handling accounting operations, and generating financial reports.

This is a full-stack application built with a modern tech stack, featuring a React-based frontend and a Node.js/Express backend with MongoDB database.

**Documentation**: Long-form guides and reference notes for this repo live under `tenant-management-frontend/references/` (for example this file and `QUICK_REFERENCE.md`).

---

## 🔄 Recent updates (2026)

- **Dashboard UI**: Responsive **bento grid** layout with breakpoint-specific column rules; **fiscal year (FY) picker** (current vs previous Nepali FY) drives the revenue chart and related stats; **Needs Attention** panel (`NeedsAttentionPanel.jsx`) replaces the older attention banner components, with severity styling and links into workflows; compact **BarDiagram** height with **KpiStrip**, **BuildingHealthPanel**, **RecentActivities**, and **BuildingPerformanceGrid**. Header uses a **slot pattern** (`HeaderSlotContext`) for **global search** plus quick actions (add tenant, record payment). Loading and error states include a **retry** control.
- **App shell**: **AppLayout** coordinates sidebar width with the header via CSS variable `--sidebar-width`; **ThemeProvider** and collapsible sidebar; admin navigation grouped in `app-sidebar.jsx`.
- **Ledger / journal builders**: **Revenue received** journals require an explicit **`paymentMethod`**; **`bankAccountCode`** is required for bank transfer and cheque (no silent default to the generic cash control account). **Nepali dates** on journal payloads are normalized to BS `YYYY-MM-DD` strings; English `YYYY-MM-DD` strings are converted through `Date` before `NepaliDate` to avoid misparsing AD as BS. **Expense** journals use the same nepali-date resolution and credit-account helpers (`paymentAccountUtils`).
- **Revenue service**: Bank account code resolution is explicit (`bankAccountCode`, `bankAccountId`, `paymentMethod`); journal posting aligns with the stricter builder contract.
- **Expenses API**: Create expense accepts **`nepaliDate`** (same shape as revenue dialogs) or **`nepaliDateStr`** for backward compatibility.

---

## 🏗️ Architecture

### Frontend (`tenant-management-frontend`)
- **Framework**: React 18.3.1 with Vite
- **Routing**: React Router DOM v7
- **State Management**: React Context API (AuthContext)
- **UI Library**: shadcn/ui components (Radix UI primitives)
- **Styling**: Tailwind CSS v4
- **Form Handling**: Formik with Yup validation
- **HTTP Client**: Axios with interceptors
- **Real-time**: Socket.io client
- **Date Handling**: Nepali date conversion libraries
- **Charts**: Recharts
- **Notifications**: Sonner (toast notifications)

### Backend (`tenant-management-backend`)
- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js v5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with bcryptjs
- **File Upload**: Multer with Cloudinary integration
- **Real-time**: Socket.io
- **Scheduling**: Node-cron for automated tasks
- **Email**: Nodemailer for email notifications
- **PDF Generation**: PDFKit
- **Validation**: Yup

---

## ✨ Key Features

### 1. **Authentication & Authorization** ✅
- User registration and login
- JWT-based authentication
- Email verification system
- Password change functionality
- Protected routes
- Session management with refresh tokens
- Auto-logout on token expiration

### 2. **Tenant Management** ✅ (85% Complete)
- **Add Tenant**: Comprehensive form with:
  - Personal information (name, email, phone, address)
  - Unit selection (property, block, inner block)
  - Lease details (start/end dates, key handover, space handover)
  - Document uploads (citizenship, agreement, photos)
  - Financial details (sqft, price per sqft, CAM rate, security deposit)
  - Dual calendar (English/Nepali dates)
- **View Tenants**: Grid display with tenant cards
- **Tenant Details**: Detailed view with document viewer (PDF/images)
- **Edit Tenant**: Form exists, needs API integration
- **Delete Tenant**: Soft delete functionality
- **Search & Filter**: Filter by property, block, inner block, search by name

### 3. **Rent & Payment Management** ✅ (60% Complete)
- **Rent Processing**: Automated monthly rent generation via cron jobs
- **Rent Payment Recording**: Record rent and CAM payments
- **Payment History**: View all payment transactions
- **Rent Summary**: Dashboard showing collected, pending, and outstanding amounts
- **Payment Methods**: Support for Cash, Bank Transfer, Cheque
- **Receipt Generation**: Email receipts for payments
- **Payment Filters**: Filter by tenant, date range, status
- **Rent Dashboard**: Comprehensive rent payment interface with tables and summaries

### 4. **Dashboard** ✅ (75% Complete)
- **Layout**: CSS Grid **bento** layout from mobile through `2xl` breakpoints; chart + attention/health sidebar uses a ~2:1 width split on large screens
- **KPI strip** (`KpiStrip`): Key metrics with loading states
- **Fiscal year scope**: Nepali FY toggle (**this year** / **last year**) for chart and period-aware stats (`getFYLabel`, `getFYStartYear`, `getTodayNepali`)
- **Revenue trend**: `BarDiagram` receives `stats`, `period`, and error/loading props
- **Needs attention**: `NeedsAttentionPanel` surfaces prioritized items (overdue rent, contracts, maintenance, electricity, etc.) from normalized dashboard stats, with severity and deep links
- **Building health & performance**: `BuildingHealthPanel`, `BuildingPerformanceGrid`
- **Recent activity**: `RecentActivities` feed
- **Header actions**: Optional slot content—**global search**, **Add Tenant**, **Record Payment** (`Dashboard.jsx` + `HeaderSlotContext`)
- **Nepali date**: Greeting/time hooks (`UseTime`) and FY labels

### 5. **Accounting Module** ✅ (Basic Implementation)
- **Accounting Summary**: Dashboard statistics
- **Ledger Management**: Track financial transactions; journal builders enforce **double-entry** with explicit **payment method** and **bank sub-accounts** where applicable (revenue received and expense flows)
- **Account Management**: Manage chart of accounts
- **Transaction Recording**: Record debit/credit transactions
- **Revenue & Liabilities Tracking**: Separate tracking for revenue sources and liability sources
- **Data integrity**: Manual revenue and expense postings use shared helpers so **Nepali ledger dates** stay as BS strings and **cash vs bank** postings match the selected instrument

### 6. **Revenue Management** ✅
- **Create Revenue Records**: Track various revenue sources; UI (`AddRevenueDialog`) aligned with **payment method** and **bank account** selection for ledger posting
- **Revenue Sources**: Categorize revenue (rent, CAM, other)
- **Revenue Analytics**: View revenue by source
- **Get All Revenue**: List all revenue records with filtering
- **Backend**: Service resolves `bankAccountCode` / `bankAccountId` per entity and passes validated options into `buildRevenueReceivedJournal`

### 7. **Bank Account Management** ✅ (80% Complete)
- **Add Bank Account**: Create bank account records
- **List Bank Accounts**: View all bank accounts
- **Delete Bank Account**: Soft delete functionality
- **Update Bank Account**: Needs implementation

### 8. **Property & Unit Management** ✅
- **Property Management**: Create and manage properties
- **Block Management**: Organize properties into blocks
- **Inner Block Management**: Further subdivision of blocks
- **Unit Management**: Manage individual rental units

### 9. **CAM (Common Area Maintenance) Management** ✅
- **CAM Calculation**: Automated CAM charge calculation
- **CAM Payment Tracking**: Track CAM payments separately from rent
- **CAM Rate Management**: Set CAM rates per square foot

### 10. **Electricity Management** ⚠️ (Backend Exists)
- **Electricity Tracking**: Track electricity consumption and billing
- **Electricity Model**: Database model exists
- **Frontend Integration**: Needs completion

### 11. **Maintenance Management** ⚠️ (20% Complete)
- **Frontend UI**: Maintenance request form exists
- **Backend**: Missing complete implementation
- **Features Needed**:
  - Create maintenance requests
  - Track maintenance status (Open, In Progress, Completed, Cancelled)
  - Priority levels (Low, Medium, High)
  - Maintenance types (Repair, Maintenance)
  - Cost tracking

### 12. **Cheque/Draft Management** ❌ (Not Started)
- **Frontend**: Placeholder component exists
- **Backend**: Completely missing
- **Features Needed**:
  - Record cheque/draft details
  - Track cheque status (Pending, Cleared, Bounced, Cancelled)
  - Cheque reconciliation
  - Link cheques to payments

### 13. **Notifications System** ⚠️ (Partial)
- **Notification Model**: Database model exists
- **Basic Retrieval**: Can fetch notifications
- **Missing Features**:
  - Mark as read
  - Delete notifications
  - Unread count
  - Real-time notifications

### 14. **Admin Settings** ✅ (80% Complete)
- **Bank Account Management**: Add, list, delete bank accounts
- **Password Change**: Change admin password
- **Profile Update**: Form exists, needs API integration

### 15. **Reporting & Analytics** ⚠️ (Partial)
- **Dashboard Statistics**: Basic stats available
- **Payment Reports**: Payment history with filters
- **Revenue Reports**: Revenue by source
- **Missing**: Advanced analytics, export functionality, custom date ranges

---

## 🗂️ Project Structure

### Backend Structure
```
tenant-management-backend/
├── src/
│   ├── app.js                    # Main Express app
│   ├── server.js                 # Server entry point
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── modules/
│   │   ├── auth/                 # Authentication module
│   │   ├── tenant/               # Tenant management
│   │   │   ├── cam/              # CAM management
│   │   │   ├── units/            # Unit management
│   │   │   └── securityDeposits/ # Security deposit tracking
│   │   ├── rents/                # Rent management
│   │   ├── payment/              # Payment processing
│   │   ├── accounting/           # Accounting module
│   │   ├── revenue/              # Revenue tracking
│   │   ├── expenses/             # Expense records & sources
│   │   ├── banks/                # Bank account management
│   │   ├── ledger/               # Ledger & transactions
│   │   ├── electricity/          # Electricity tracking
│   │   ├── notifications/        # Notification system
│   │   └── dashboards/           # Dashboard statistics
│   └── cron/                     # Scheduled tasks
│       ├── monthlyRentAndCam.cron.js  # Auto-generate rents
│       └── monthlyEmail.cron.js        # Send monthly emails
```

### Frontend Structure
```
tenant-management-frontend/
├── references/                   # Project docs (overview, quick reference, domain notes)
└── tenant/
    └── src/
        ├── main.jsx                  # App entry point
        ├── App.jsx                   # Main app component with routes
        ├── components/
        │   ├── ui/                   # shadcn/ui components
        │   ├── layout/               # AppLayout, shell (sidebar + header slot)
        │   ├── header.jsx            # Top bar; supports HeaderSlotContext
        │   ├── app-sidebar.jsx       # Admin navigation
        │   └── ...
        ├── context/
        │   ├── AuthContext.jsx
        │   ├── HeaderSlotContext.jsx # Injects dashboard actions / search into header
        │   └── ThemeContext.jsx
        ├── hooks/
        ├── plugins/
        │   ├── axios.js
        │   └── socket.js
        ├── Dashboard/
        │   ├── Dashboard.jsx         # Main dashboard (bento grid, FY picker)
        │   └── component/            # KpiStrip, BarDiagram, NeedsAttentionPanel, etc.
        ├── Accounts/                 # Accounting module, AddRevenueDialog, AddExpenseDialog
        ├── RentPaymentDashboard/
        ├── tenants.jsx
        ├── addTenants.jsx
        ├── editTenant.jsx
        ├── Revenue.jsx
        ├── Maintenance.jsx
        ├── Electricity.jsx
        ├── Cheque_drafts.jsx
        ├── payments.jsx
        └── Admin.jsx
```

---

## 🗄️ Database Models

### Core Models

1. **Tenant Model**
   - Personal information (name, email, phone, address)
   - Documents (citizenship, agreement, photos)
   - Unit references (property, block, inner block, units)
   - Financial details (price per sqft, CAM rate, security deposit)
   - Lease dates (agreement signed, start, end, handover dates)
   - Status (active, inactive, vacated)

2. **Rent Model**
   - Tenant reference
   - Property/Block/InnerBlock references
   - Month/Year (English calendar)
   - Amounts (rent, paid, TDS, CAM)
   - Status (pending, paid, overdue, partial)
   - Payment dates

3. **Payment Model**
   - Rent reference
   - Tenant reference
   - Payment amount
   - Payment method (Cash, Bank Transfer, Cheque)
   - Payment date
   - Bank account reference (if applicable)
   - Receipt generation

4. **Property/Block/InnerBlock/Unit Models**
   - Hierarchical structure for organizing properties
   - Property → Block → Inner Block → Unit

5. **Bank Account Model**
   - Account details (number, name, bank name)
   - Balance tracking
   - Soft delete support

6. **Ledger & Transaction Models**
   - Chart of accounts
   - Debit/Credit transactions
   - Account balances
   - Journal builders (`ledger/journal-builders/`) tie revenue and expenses to **payment method** and **bank/cash** accounts; nepali posting dates stored as BS strings

7. **Revenue Model**
   - Revenue source
   - Amount
   - Date
   - Description

8. **CAM Model**
   - CAM rate per sqft
   - Monthly CAM charges
   - Payment tracking

9. **Admin Model**
   - User credentials
   - Profile information
   - Authentication tokens

---

## 🔌 API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /verify-email` - Email verification
- `POST /resend-email-verification` - Resend verification
- `PATCH /change-password` - Change password
- `POST /refresh-token` - Refresh JWT token
- `GET /get-me` - Get current user

### Tenant Management (`/api/tenant`)
- `POST /create-tenant` - Create new tenant
- `GET /search-tenants` - Search/filter tenants
- `GET /get-tenant/:id` - Get tenant details
- `PATCH /update-tenant/:id` - Update tenant
- `DELETE /delete-tenant/:id` - Delete tenant

### Rent Management (`/api/rent`)
- `POST /process-monthly-rents` - Generate monthly rents
- `GET /get-rents` - Get all rents
- `POST /send-email-to-tenants` - Send rent reminders

### Payment Management (`/api/payment`)
- `POST /pay-rent-and-cam` - Record payment
- `GET /get-rent-summary` - Get rent summary
- `GET /dashboard-stats` - Dashboard statistics
- `POST /send-receipt/:paymentId` - Email receipt
- `GET /get-all-payment-history` - All payments
- `GET /get-payment-history-by-tenant/:tenantId` - Tenant payments
- `GET /get-filtered-payment-history` - Filtered payments
- `GET /get-payment-by-id/:paymentId` - Get payment details

### Accounting (`/api/accounting`)
- `GET /summary` - Accounting summary

### Revenue (`/api/revenue`)
- `POST /create` - Create revenue record
- `GET /get/:id` - Get revenue by ID
- `GET /get-all` - Get all revenue
- `GET /get-revenue-source` - Get revenue sources

### Bank Accounts (`/api/bank`)
- `POST /create-bank-account` - Create bank account
- `GET /get-bank-accounts` - List bank accounts
- `PATCH /delete-bank-account/:id` - Delete bank account

### Dashboard (`/api/dashboard`)
- `GET /stats` - Consolidated dashboard statistics

### Ledger (`/api/ledger`)
- Ledger and transaction management endpoints

### Electricity (`/api/electricity`)
- Electricity tracking endpoints

### CAM (`/api/cam`)
- CAM management endpoints

---

## 🤖 Automated Features

### Cron Jobs
1. **Monthly Rent Generation** (`monthlyRentAndCam.cron.js`)
   - Automatically generates rent records for all active tenants
   - Calculates rent and CAM charges
   - Runs monthly on a scheduled date

2. **Monthly Email Notifications** (`monthlyEmail.cron.js`)
   - Sends email reminders to tenants
   - Notifies about upcoming rent due dates
   - Sends rent statements

---

## 🌐 Internationalization

- **Nepali Date Support**: Full integration with Nepali calendar
- **Date Conversion**: Automatic conversion between English and Nepali dates
- **Display**: Dates shown in Nepali format (YYYY-MMM-DD)
- **Libraries**: 
  - `nepali-date-converter`
  - `nepali-datetime`
  - `@sajanm/nepali-date-picker`

---

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password encryption
- **Protected Routes**: Frontend route guards
- **CORS Configuration**: Configured for frontend origin
- **Cookie-based Sessions**: Secure cookie handling
- **Input Validation**: Yup schema validation
- **File Upload Security**: Cloudinary integration with validation

---

## 📊 Current Status

### Overall Completion: ~52-57%

#### ✅ Fully Implemented Modules (6)
1. Payment Module - 100%
2. Revenue Module - 100% (ledger posting rules tightened for bank/cash accuracy)
3. Accounting Module - 80% (basic implementation; journal/date fixes in progress)
4. Dashboard Module - ~75% (redesigned layout, FY-scoped chart, needs-attention panel)
5. Bank Account Management - 80%
6. Ledger & Transactions - ~85% (stricter revenue/expense journal contracts)

#### ⚠️ Partially Implemented Modules (5)
1. Tenant Management - 85%
2. Rent Management - 60%
3. Maintenance Module - 20% (UI only)
4. Admin Settings - 80%
5. Notification System - 40%

#### ❌ Missing Modules (2)
1. Cheque/Draft Management - 0%
2. Complete Maintenance Backend - 0%

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (local or cloud instance)
- npm or yarn

### Backend Setup
```bash
cd tenant-management-backend
npm install
# Create .env file with:
# - MONGODB_URI
# - JWT_SECRET
# - FRONTEND_URL
# - CLOUDINARY credentials
# - Email service credentials
npm run dev
```

### Frontend Setup
```bash
cd tenant-management-frontend/tenant
npm install
# Configure API base URL in plugins/axios.js
npm run dev
```

---

## 🎯 Future Roadmap

### High Priority
1. Complete Maintenance Module backend
2. Implement Cheque/Draft Management
3. Complete Rent Management endpoints
4. Admin Profile Update API
5. Bank Account Update functionality

### Medium Priority
1. Enhanced Reporting & Analytics
2. Export functionality (PDF/Excel)
3. Advanced filtering and search
4. Notification management features
5. Email verification flow completion

### Low Priority
1. Further dashboard analytics beyond FY-scoped revenue trend
2. Contract renewal management
3. Mobile responsiveness improvements
4. Performance optimizations
5. Comprehensive test suite

---

## 📝 Notes

- The system uses **Nepali calendar** extensively for date handling; API and ledger code normalize **BS `YYYY-MM-DD`** strings and avoid passing raw `Date` objects where a string is required
- Converting English calendar strings to Nepali uses an explicit **`Date`** intermediate where libraries would otherwise interpret `YYYY-MM-DD` as Bikram Sambat
- **Soft deletes** are implemented for most models (isDeleted flag)
- **Real-time updates** via Socket.io (partially implemented)
- **File storage** handled via Cloudinary
- **PDF generation** for receipts and reports
- **Email notifications** for various events

---

## 👥 Target Users

- Property managers
- Landlords
- Real estate administrators
- Building administrators
- Property management companies

---

## 📄 License

[Specify license if applicable]

---

**Last Updated**: March 29, 2026  
**Project Status**: Active Development  
**Version**: 1.0.0 (Development)
