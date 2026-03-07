# Mazad (Frontend + Backend)

This repository contains:
- A Vite + React frontend in the project root
- An Express + MongoDB backend in `backend/`

## Prerequisites

- Node.js 18+
- npm
- MongoDB instance

## Install

1. Install frontend dependencies:
   ```bash
   npm install
   ```
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

## Environment Variables

### Frontend (`.env` in project root)

Required:
- `VITE_API_URL` (example: `http://localhost:5000`)

### Backend (`backend/.env`)

Required (minimum):
- `MONGO_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `PORT` (optional fallback exists, defaults to `5000`)

Optional feature-specific keys:
- Cloudflare R2: `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- Payments/ZainCash and redirects: `ZC_*`, `FRONTEND_*_URL`, `BACKEND_URL`
- Financial platform account: `PLATFORM_USER_ID`

## Run Locally

Run backend (terminal 1):
```bash
cd backend
npm run dev
```

Run frontend (terminal 2):
```bash
npm run dev
```

## Syntax Check Utility

To check backend JavaScript syntax quickly:
```bash
node check-syntax.js
```

This script scans `backend/` recursively (excluding `node_modules`, `.git`, and `dist`) and reports syntax errors.
