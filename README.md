# ControlDeck

A personal productivity and developer dashboard built with React, Vite, Express, and MongoDB Atlas.

## Features
- Public, read-only dashboard for tasks, projects, notes, and quick links.
- Password-protected admin mode for creating, editing, completing, and deleting items.
- Cross-device persistence through MongoDB Atlas.
- Responsive dark interface with high-contrast, colorblind-conscious status colors.
- No secrets or private configuration are shipped to the frontend.

## Project structure
```
backend/   Express API and MongoDB models
frontend/  React + Vite application
```

## Requirements
- Node.js 20.19+ or 22.12+
- MongoDB Atlas database
- GitHub account

## Run locally

### 1. Backend
```powershell
cd backend
npm install
Copy-Item .env.example .env
```
Set `MONGODB_URI`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in `backend/.env`. Use a long, unique admin password and a random session secret (at least 32 characters).

```powershell
npm run dev
```
API runs at http://localhost:5000.

### 2. Frontend
Open a second PowerShell terminal:
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Open the URL printed by Vite (usually http://localhost:5173).

## Deployment outline
- Database: create a MongoDB Atlas database and allow connections from your backend host.
- Backend: deploy the `backend` folder as a Node web service. Set `MONGODB_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CLIENT_ORIGIN`, and `NODE_ENV=production`.
- Frontend: deploy the `frontend` folder as a static site. Set `VITE_API_URL` to the deployed backend URL (no trailing slash).
- Set `CLIENT_ORIGIN` to the exact deployed frontend origin.

## Security notes
- Public endpoints only return dashboard content intended to be public. Do not store private notes, credentials, tokens, or personal information here.
- Admin mutations require a server-side password and an HTTP-only session cookie.
- Use HTTPS in production. Keep all secrets in the hosting provider's environment settings, never in Git.
- The API uses same-site cookie settings and an origin allowlist. If frontend and backend are on different sites, configure the deployment domains carefully; cross-site cookie restrictions may require hosting them under a compatible domain.
