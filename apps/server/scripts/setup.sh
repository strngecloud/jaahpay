#!/bin/bash

# Jahpay Server Setup Script
set -e

echo "🚀 Setting up Jahpay Spending Server..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your actual credentials"
fi

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL & Redis)..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done

echo "✅ PostgreSQL is ready"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
done

echo "✅ Redis is ready"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your credentials"
echo "2. Run 'pnpm run start:dev' to start the server"
echo ""
echo "Services running:"
echo "- PostgreSQL: localhost:5432"
echo "- Redis: localhost:6379"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f"
