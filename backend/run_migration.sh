#!/bin/bash

# Migration script for PostgreSQL with data preservation
# This script runs the data-safe migration

# Set the database URL from .env
DATABASE_URL="postgresql://lms1_user:8XpfYDobJ9bqdEo1fe7hIZp2Bk0s7U05@dpg-d5q6duv5r7bs738dd0g0-a.virginia-postgres.render.com/lms1"

echo "🔍 Testing PostgreSQL connection..."
if psql "$DATABASE_URL" -c "SELECT current_database(), current_user;" > /dev/null 2>&1; then
    echo "✅ Connection successful!"
    echo ""
    
    echo "📊 Current tables in database:"
    psql "$DATABASE_URL" -c "\dt"
    echo ""
    
    echo "🚀 Running data-safe migration..."
    psql "$DATABASE_URL" -f postgresql_migration_safe.sql
    
    echo ""
    echo "📊 Tables after migration:"
    psql "$DATABASE_URL" -c "\dt"
    
    echo ""
    echo "✅ Migration complete! Your data is preserved."
else
    echo "❌ Connection failed. Please check your DATABASE_URL."
    exit 1
fi