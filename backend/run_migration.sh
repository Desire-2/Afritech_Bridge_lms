#!/bin/bash

# Migration script for PostgreSQL with data preservation
# This script runs the data-safe migration
#
# IMPORTANT: Production credentials must NEVER be hardcoded in this file.
# Set DATABASE_URL from your environment (.env / Render dashboard) instead.

# Set the database URL from the environment (.env / Render)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set. Export it first, e.g.:"
    echo "   export DATABASE_URL=postgresql://user:password@host:5432/dbname"
    exit 1
fi

MIGRATION_FILE="${1:-postgresql_migration_safe.sql}"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file '$MIGRATION_FILE' not found. Nothing to apply."
    exit 1
fi

echo "🔍 Testing PostgreSQL connection..."
if psql "$DATABASE_URL" -c "SELECT current_database(), current_user;" > /dev/null 2>&1; then
    echo "✅ Connection successful!"
    echo ""
    
    echo "📊 Current tables in database:"
    psql "$DATABASE_URL" -c "\dt"
    echo ""
    
    echo "🚀 Running data-safe migration ($MIGRATION_FILE)..."
    psql "$DATABASE_URL" -f "$MIGRATION_FILE"
    
    echo ""
    echo "📊 Tables after migration:"
    psql "$DATABASE_URL" -c "\dt"
    
    echo ""
    echo "✅ Migration complete! Your data is preserved."
else
    echo "❌ Connection failed. Please check your DATABASE_URL."
    exit 1
fi
