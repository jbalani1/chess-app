# Chess Analysis App Makefile

.PHONY: help install-worker install-web setup-db test clean analyze

# Default target
help:
	@echo "Chess Analysis App - Available commands:"
	@echo ""
	@echo "Setup:"
	@echo "  make install-worker    Install Python dependencies"
	@echo "  make install-web       Install Node.js dependencies"
	@echo "  make setup-db          Setup database schema"
	@echo "  make setup             Setup everything"
	@echo ""
	@echo "Development:"
	@echo "  make test              Run Python tests"
	@echo "  make dev               Start web development server"
	@echo "  make analyze USERNAME=username YEAR=2024 MONTH=1  Analyze games"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean             Clean up temporary files"
	@echo "  make seed USERNAME=username YEAR=2024 MONTH=1  Run demo script"

# Setup commands
install-worker:
	@echo "Installing Python dependencies..."
	cd worker && pip install -r requirements.txt

install-web:
	@echo "Installing Node.js dependencies..."
	cd web && npm install

setup-db:
	@echo "Setting up database schema..."
	@echo "Please run the SQL from db/schema.sql in your Supabase SQL editor"

setup: install-worker install-web setup-db
	@echo "Setup complete! Don't forget to:"
	@echo "1. Copy env.example to .env and fill in your credentials"
	@echo "2. Run the database schema in Supabase"
	@echo "3. Start the web app with 'make dev'"

# Development commands
test:
	@echo "Running Python tests..."
	cd worker && python -m pytest tests/ -v

dev:
	@echo "Starting Next.js development server..."
	cd web && npm run dev

# Analysis commands
analyze:
	@echo "Analyzing games for $(USERNAME) in $(YEAR)-$(MONTH)..."
	cd worker && python ingest.py $(USERNAME) $(YEAR) $(MONTH)

seed:
	@echo "Running demo script for $(USERNAME) in $(YEAR)-$(MONTH)..."
	cd worker && python seed_one_month.py $(USERNAME) $(YEAR) $(MONTH)

# Utility commands
clean:
	@echo "Cleaning up temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -delete
	rm -rf worker/bin/
	rm -rf web/.next/
	rm -rf web/node_modules/.cache/

# Production commands
build:
	@echo "Building web app for production..."
	cd web && npm run build

start:
	@echo "Starting production web server..."
	cd web && npm start

# Database commands
db-reset:
	@echo "Resetting database (WARNING: This will delete all data!)"
	@echo "Please run this manually in Supabase SQL editor:"
	@echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	@echo "Then run: make setup-db"

# Help for specific commands
analyze-help:
	@echo "Usage: make analyze USERNAME=username YEAR=year MONTH=month"
	@echo "Example: make analyze USERNAME=magnuscarlsen YEAR=2024 MONTH=1"

seed-help:
	@echo "Usage: make seed USERNAME=username YEAR=year MONTH=month"
	@echo "Example: make seed USERNAME=magnuscarlsen YEAR=2024 MONTH=1"
