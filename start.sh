#!/bin/bash

echo "Starting CommonCare..."

# Stop any existing containers
docker compose down 2>/dev/null

# Build and start containers
docker compose up --build -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Check if containers are running
if docker compose ps | grep -q "Up"; then
    echo "CommonCare is running!"
    echo ""
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:5000/api/health"
    echo "Database: localhost:5432"
    echo ""
    
    # Open browser (Linux)
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:8080
    elif command -v gnome-open &> /dev/null; then
        gnome-open http://localhost:8080
    fi
else
    echo "Failed to start containers. Check logs with: docker compose logs"
fi
