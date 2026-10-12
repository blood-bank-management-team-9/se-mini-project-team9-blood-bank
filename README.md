# Blood Bank Management – Team 9

## Structure (SAD 4.1)
- `backend/` – Express API (`routes → controllers → services → models`)
- `frontend/` – React (Vite) client
- `docs/` – SRS, SAD, Test Plan

## Run
```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev        # API :5000, UI :5173
npm test           # Jest + Supertest
```
