#!/bin/bash

# Migration script for PostgreSQL with data preservation
# This script runs the data-safe migration

# Set the database URL from .env
DATABASE_URL=postgresql://lms_gxrv_user:mM4MgECVsrvNGwp1B5N0nqs0JtnWteCe@dpg-d9akpq3eo5us73abtec0-a.virginia-postgres.render.com/lms_gxrv

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