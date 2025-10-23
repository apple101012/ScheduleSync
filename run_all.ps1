# Run all helper: start docker services and seed sample data
# Usage: run in repository root: .\run_all.ps1

Write-Host "Starting Docker Compose services..."
docker compose up -d

# find backend container id
$backendId = docker compose ps -q backend
if (-not $backendId) {
  Write-Error "Backend container not found"
  exit 1
}

# copy seed script into container
Write-Host "Copying seed script into backend container..."
$dest = $backendId + ':/app/seed_sample_data.py'
docker cp .\backend\seed_sample_data.py $dest

# run the seed script inside the container
Write-Host "Running seed script inside backend container..."
docker compose exec backend python /app/seed_sample_data.py

Write-Host "Done. Seed output above. You can now open the frontend at http://localhost:5173 and login with 'apple'/'apple' or other sample accounts."