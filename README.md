GitHub Integration Application
This application provides a GitHub OAuth 2.0 integration with a Node.js/Express backend and an Angular frontend using Angular Material and AG Grid for data display, dockerized with a MongoDB service. It supports live reloading for development, so code changes are reflected without rebuilding Docker images.
Prerequisites

Docker and Docker Compose installed
GitHub account with an OAuth app configured
At least one organization with 3+ repositories, each having 2000+ commits, 1000+ pull requests, and 500+ issues

Setup Instructions
Dockerized Setup

Clone or create the project directory with the provided folder structure.
Create a .env file in the backend directory with your GitHub OAuth credentials:GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret


In the root directory (github-integration), run:docker-compose up --build


Access the application:
Frontend: http://localhost:4200
Backend API: http://localhost:3000
MongoDB: localhost:27017


Make changes to backend or frontend code:
Backend: Changes to .js files in backend/ trigger nodemon to restart the server.
Frontend: Changes to .ts, .html, or .css files in frontend/src/ trigger Angular's live reload.



MongoDB Setup

MongoDB is provided via the mongo:latest image.
Data is persisted in the mongo-data volume.
Collections (github-integration, organizations, repos, commits, pulls, issues, users) are created automatically.

Testing Instructions

Create a GitHub account for testing purposes.
Set up an OAuth app in GitHub to obtain GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET. Set the callback URL to http://localhost:4200/callback.
Ensure your GitHub account has at least one organization with 3+ repositories, each containing:
2000+ commits
1000+ pull requests
500+ issuesYou can import public open-source repositories to meet these requirements.


Test the authentication flow by clicking "Connect to GitHub" and following the OAuth process.
Verify the following:
Green checkmark appears after successful connection
Connected date is displayed
AG Grid displays data from selected collections
Filters and search functionality work across all columns
Pagination works correctly
Remove Integration button clears the connection and database
Reconnection is possible after removal


Test live reloading by modifying code (e.g., add a console log in backend/controllers/githubController.js or change text in frontend/src/app/components/github-integration/github-integration.component.html) and verify changes are reflected without rebuilding.

Features

OAuth 2.0 authentication with GitHub
Stores integration details in MongoDB
Displays GitHub data (organizations, repos, commits, pulls, issues, users) in AG Grid
Supports full-text search across all columns
Implements pagination with configurable page size
Allows removal and reconnection of GitHub integration
Dynamically generates columns based on collection data
Responsive design utilizing maximum screen real estate
Live reloading for backend (via nodemon) and frontend (via Angular CLI)
Dockerized services for easy setup

Troubleshooting

Environment variable warnings: Ensure the backend/.env file exists and contains valid GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET. Verify that Docker Compose loads the .env file correctly by checking the logs (docker-compose logs backend).
Frontend not connecting to backend: Ensure the frontend makes API calls to http://localhost:3000/api/github. If you encounter CORS issues, verify the backend's CORS middleware is configured correctly in backend/app.js.
Live reloading not working: Check that CHOKIDAR_USEPOLLING=true is set in the frontend service and that volume mounts are correctly configured in docker-compose.yml.
MongoDB connection issues: Confirm the backend connects to mongodb:27017 (check backend/app.js). View MongoDB logs with docker-compose logs mongodb.

Notes

Ensure the .env file is not committed to version control for security.
The application runs on http://localhost:4200 (frontend) and http://localhost:3000 (backend).
Use the GitHub API documentation (https://docs.github.com/en/rest?apiVersion=2022-11-28) for reference.
To stop Docker services, run docker-compose down. To clear MongoDB data, use docker-compose down -v.
The CHOKIDAR_USEPOLLING=true environment variable ensures file watching works in Docker for the frontend.