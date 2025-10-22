- ScheduleSync is a full-stack app with a React (Vite) frontend, FastAPI backend, MongoDB, and JWT authentication, all orchestrated with Docker Compose.

- The project uses a custom modern.css for styling, and all main React pages (Login, Register, Dashboard) include console.log debugging for form values, API requests, responses, and errors.

- Sample data can be loaded into MongoDB using the sample-data.js script (see README for details).

- Nginx is configured for SPA routing in production.

- Dev Containers support is enabled via .devcontainer/devcontainer.json. To develop in a containerized environment, use "Dev Containers: Reopen in Container" in VS Code. This will launch all services and install frontend dependencies automatically.

- For debugging, check the browser console for logs on all user actions. Backend logs are available via Docker.
 - For debugging, check the browser console for logs on all user actions. Backend logs are available via Docker.

Current runtime status and known issues (Oct 2025)
- Dev Container support was temporarily added then removed; there is no active `.devcontainer/devcontainer.json` that the workspace will auto-open.
- Frontend now uses an injected environment variable `VITE_API_URL` (fallbacks to `http://localhost:8000`) and pages were updated to call backend endpoints directly (Login, Register, Dashboard). Ensure the frontend build includes the correct `VITE_API_URL`.
- Production frontend is served by nginx (container `frontend`) and will respond on host port 5173. nginx serves static files and will return HTML 405/404 pages when API requests hit nginx instead of the backend.
- Sample data initially contained placeholder/malformed bcrypt strings which caused the backend to raise exceptions when verifying passwords. A `backend/test.py` helper was added to generate and insert valid bcrypt hashes and reset sample data, but passlib/bcrypt incompatibilities in the container were encountered during automated hashing.

Errors seen during testing
- Browser console: "SyntaxError: JSON.parse: unexpected character" when login POST returned an HTML 405 page from nginx (frontend calling `/api/login` instead of backend).
- Backend logs: "ValueError: malformed bcrypt hash (checksum must be exactly 31 chars)" and later "password cannot be longer than 72 bytes" when trying to run passlib hashing in certain contexts.

Immediate remediation steps for the next developer
1) Verify services are running:
	- `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
2) Ensure frontend points at backend during development (quickest): create `frontend/.env` with `VITE_API_URL=http://localhost:8000`, then rebuild frontend:
	- `docker compose build frontend`
	- `docker compose up -d frontend`
	- Hard-refresh browser `Ctrl+Shift+R` to clear cached assets.
3) Reset sample data with known bcrypt hashes for testing users (apple/apple and alice/password123):
	- Option A (manual, resilient): generate bcrypt hashes inside the backend container and insert into Mongo:
	  - `docker compose exec backend python -c "import bcrypt; print(bcrypt.hashpw(b'password123'[:72], bcrypt.gensalt()).decode()); print(bcrypt.hashpw(b'apple'[:72], bcrypt.gensalt()).decode())"`
	  - Copy the printed hashes and run:
		 `docker exec -it schedulesync-mongo mongosh schedulesync --eval \"db.users.deleteMany({}); db.users.insertMany([{username:'alice', email:'alice@example.com', password_hash:'<hash1>', friends:['bob','carol']},{username:'bob', email:'bob@example.com', password_hash:'<hash1>', friends:['alice']},{username:'carol', email:'carol@example.com', password_hash:'<hash1>', friends:['alice']},{username:'apple', email:'apple@example.com', password_hash:'<hash2>', friends:[]}])\"`
	- Option B (scripted): copy `backend/test.py` into the container and run `python /app/test.py insert-sample`. If passlib fails inside container, use Option A instead.
4) Test backend login directly from host (PowerShell):
	- `$body = @{username='apple'; password='apple'} | ConvertTo-Json`
	- `Invoke-RestMethod -Uri http://localhost:8000/login -Method Post -Body $body -ContentType 'application/json'`

Troubleshooting tips
- If passlib raises backend bcrypt errors, check bcrypt version in container: `docker compose exec backend python -c "import bcrypt; print(bcrypt.__version__)"`. If incompatible, either pin a compatible `bcrypt` version in `backend/requirements.txt` and rebuild, or generate hashes directly with `bcrypt` and insert them into Mongo.
- If frontend still gets HTML errors, inspect the network tab to see the exact URL used and ensure `VITE_API_URL` is correctly set before the build.

If you are picking up work from here, start by fixing frontend->backend routing (quickest wins), then reset sample data with valid bcrypt hashes, and finally verify login flows end-to-end. Keep notes of any package/version mismatches in the backend container — they are the most likely cause of hashing errors.
