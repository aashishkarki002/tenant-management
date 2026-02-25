# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview
EasyManage — a full-stack tenant management system (Node.js/Express backend + React/Vite frontend) for property managers. Uses MongoDB, JWT auth, Cloudinary for file uploads.

### Services

| Service | Directory | Dev Command | Port |
|---------|-----------|-------------|------|
| Backend API | `tenant-management-backend/` | `npm run dev` | 3000 |
| Frontend SPA | `tenant-management-frontend/tenant/` | `npm run dev` | 5173 |
| MongoDB | System service | `sudo mongod --dbpath /data/db --fork --logpath /var/log/mongod.log` | 27017 |

### Starting the dev environment

1. **Start MongoDB** (must be running before backend):
   ```
   sudo mkdir -p /data/db
   sudo mongod --dbpath /data/db --fork --logpath /var/log/mongod.log
   ```
2. **Start backend**: `cd tenant-management-backend && npm run dev`
3. **Start frontend**: `cd tenant-management-frontend/tenant && npm run dev -- --host 0.0.0.0`

### Backend `.env` file
The backend requires a `.env` file at `tenant-management-backend/.env`. Key variables:
- `MONGODB_URI` — MongoDB connection string (e.g. `mongodb://localhost:27017/tenant-management`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — any random strings for dev
- `FRONTEND_URL=http://localhost:5173`, `BACKEND_URL=http://localhost:3000`
- `CLOUDINARY_*` — required for tenant image/PDF uploads; use placeholder values if not testing uploads
- SMTP variables are optional (only needed for email verification flow)

### Important caveats
- **No automated test suite exists.** There are no test scripts or test files in the codebase. Linting is available only for the frontend: `cd tenant-management-frontend/tenant && npm run lint`
- **User registration requires SMTP.** The signup flow sends a verification email and fails without SMTP configured. To create a test user locally, insert directly into MongoDB and set `isEmailVerified: true`. The password is automatically hashed by the Mongoose pre-save hook.
- **Frontend Axios base URL is hardcoded** to `http://localhost:3000` in `tenant-management-frontend/tenant/plugins/axios.js`. The backend must run on port 3000.
- **`npm run build` (frontend) has a pre-existing case-sensitivity issue** (`./demo` vs `./Demo.jsx`). The Vite dev server resolves it fine, but production builds will fail on case-sensitive filesystems.
- **Frontend has pre-existing ESLint errors** (12 errors, 1 warning) — these are in the existing codebase, not introduced by setup.
- **Root `package.json`** only holds shared dependencies; it is not a monorepo workspace. Install dependencies separately in each sub-project.
