# BharatPOS — Modern Retail & Point of Sale System

BharatPOS is a full-stack Point of Sale (POS), Accounting, and Retail Management system with real-time sync, Conversational Voice AI billing, and GST compliance.

---

## 📁 Repository Structure

`
bharatpos-new/
├── frontend/           # Store Owner & Vendor POS Terminal (Expo / React Native Web)
│   ├── src/app/        # Billing, Inventory, GST, Cash/Bank Books, Voice AI
│   └── package.json
├── admin/              # Super Admin Control Center (Expo / React Native Web)
│   ├── src/app/        # SaaS Subscriptions, Onboarding, Staff Roles, Catalog
│   └── package.json
├── backend/            # Express & Firebase Admin SDK API Server
│   ├── server.js       # User provisioning, password reset, sync API
│   └── package.json
├── index.html          # BharatPOS Official Landing Website
├── start_all.bat       # One-click Windows development launcher
├── START_SERVERS.sh    # One-click Unix / macOS development launcher
└── README.md
`

---

## 🚀 Quick Start (Local Development)

### 1. Launch All Services Simultaneously
- **Windows:** Double-click start_all.bat
- **Mac / Linux:** Run ./START_SERVERS.sh

### 2. Manual Commands

#### Frontend (POS App)
`ash
cd frontend
npm install
npx expo start --web --port 8081
`
*Access at: http://localhost:8081*

#### Admin Portal
`ash
cd admin
npm install
npx expo start --web --port 8082
`
*Access at: http://localhost:8082*

#### Backend Server
`ash
cd backend
npm install
npm start
`
*API running at: http://localhost:8083*

---

## 🌐 Production Deployments (Vercel)

| Component | Production URL |
| :--- | :--- |
| **Frontend (POS App)** | https://pos-app-red.vercel.app |
| **Admin Portal** | https://pos-admin-bharat.vercel.app |
| **Landing Website** | https://bharatpos-new.vercel.app |

---

## 🛠️ Features

- Conversational POS Voice AI: Natural language billing and stock querying.
- GST & Tax Invoicing: Full GSTR-1, GSTR-3B summary tables and E-Invoice simulation.
- Inventory & Godown Tracking: Low stock alerts, barcode generation, multi-godown stock breakdown.
- Accounting & Ledgers: Cash & Bank books, Day book, and balance sheets.
- Zero-Latency SWR Cache: High-speed parallel data fetching for 0ms initial load times.