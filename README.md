# ScheduleSync

ScheduleSync is a full-stack web application for college students to manage and share their weekly schedules, add friends, and check each other's availability. Built with React.js (Vite + Tailwind CSS) frontend, FastAPI backend, and MongoDB database.

## Features
- User registration and login (JWT authentication)
- Input and update weekly schedules
- Add friends and view their availability
- Natural language queries (e.g., "Who’s free next Friday at 3pm?")
- Dockerized development environment

## Tech Stack
- Frontend: React.js (Vite, Tailwind CSS)
- Backend: FastAPI (Python)
- Database: MongoDB (Docker)
- Auth: JWT
- AI/NLP: Regex/spaCy (OpenAI API integration planned)

## Development
- All services run with `docker-compose up --build`
- Environment variables are managed with `.env` files
- Default database: `schedulesync`

## Folder Structure
- `frontend/` - React app
- `backend/` - FastAPI app
- `.env` files for secrets/config
- `docker-compose.yml` at root

---

## Getting Started
1. Clone the repo
2. Copy `.env.example` to `.env` in `backend/` and fill in secrets
3. Run: `docker-compose up --build`
4. Access:
	- Frontend: http://localhost:5173
	- Backend: http://localhost:8000
	- Mongo Express: http://localhost:8081

---

## License
MIT