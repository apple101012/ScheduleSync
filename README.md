# ScheduleSync

A full-stack calendar and scheduling app with:
- FastAPI backend (MongoDB, JWT, robust logging, debug endpoints, seeding)
- React + Vite + Tailwind frontend (dark mode, debugging UI)
- Docker Compose for easy orchestration

## Quick Start

1. Build and start all services:
   ```
   docker compose up --build
   ```
2. Access the frontend at http://localhost:3000
3. Access the backend API at http://localhost:8000

## Features
- User authentication (JWT)
- Event CRUD
- Friend management
- Busy/free logic
- Debug/test endpoints
- End-to-end test scripts

## Development
- All endpoints and UI actions have debug logging.
- Use the backend seeding script to populate test data.

---
See backend/ and frontend/ for more details.
