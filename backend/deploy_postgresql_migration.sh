#!/bin/bash

# PostgreSQL Migration Deployment Script for Afritec Bridge LMS
# This script applies the complete PostgreSQL migration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATION_FILE="postgresql_migration_complete.sql"
BACKUP_DIR="database_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if PostgreSQL is running
check_postgresql() {
    print_status "Checking PostgreSQL connection..."
    if ! pg_isready &> /dev/null; then
        print_error "PostgreSQL is not running or not accessible"
        print_status "Please ensure PostgreSQL is installed and running"
        exit 1
    fi
    print_success "PostgreSQL is running"
}

# Function to check if migration file exists
check_migration_file() {
    if [ ! -f "$MIGRATION_FILE" ]; then
        print_error "Migration file '$MIGRATION_FILE' not found"
        exit 1
    fi
    print_success "Migration file found"
}

# Function to create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        print_status "Created backup directory: $BACKUP_DIR"
    fi
}

# Function to backup existing database (if it exists)
backup_database() {
    if [ -n "$DATABASE_URL" ]; then
        print_status "Creating database backup..."
        BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
        
        if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
            print_success "Database backup created: $BACKUP_FILE"
        else
            print_warning "Could not create backup (database might not exist yet)"
        fi
    else
        print_warning "DATABASE_URL not set - skipping backup"
    fi
}

# Function to apply migration
apply_migration() {
    print_status "Applying PostgreSQL migration..."
    
    if [ -n "$DATABASE_URL" ]; then
        # Use DATABASE_URL if available
        if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
            print_success "Migration applied successfully using DATABASE_URL"
        else
            print_error "Migration failed"
            exit 1
        fi
    else
        # Try with local PostgreSQL
        print_status "DATABASE_URL not set, trying with local PostgreSQL..."
        
        # Set up connection parameters
        DB_NAME="${POSTGRES_DB:-afritec_lms}"
        DB_USER="${POSTGRES_USER:-postgres}"
        DB_PASSWORD="${POSTGRES_PASSWORD:-}"
        
        # Export PGPASSWORD for authentication
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        print_status "Creating database '$DB_NAME' if it doesn't exist..."
        createdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
        
        # Apply migration
        if psql -U "$DB_USER" -d "$DB_NAME" -h localhost -f "$MIGRATION_FILE"; then
            print_success "Migration applied successfully to local database '$DB_NAME'"
        else
            print_error "Migration failed"
            exit 1
        fi
    fi
}

# Function to verify migration
verify_migration() {
    print_status "Verifying migration..."
    
    # Count tables to ensure migration was successful
    local table_count
    if [ -n "$DATABASE_URL" ]; then
        table_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    else
        DB_NAME="${POSTGRES_DB:-afritec_lms}"
        DB_USER="${POSTGRES_USER:-postgres}"
        DB_PASSWORD="${POSTGRES_PASSWORD:-}"
        
        # Export PGPASSWORD for authentication
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        table_count=$(psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    fi
    
    table_count=$(echo $table_count | tr -d ' ')
    
    if [ "$table_count" -gt "30" ]; then
        print_success "Migration verification passed - $table_count tables created"
    else
        print_warning "Migration verification: Only $table_count tables found (expected 30+)"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --no-backup    Skip database backup"
    echo "  --verify-only  Only verify existing migration"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL   PostgreSQL connection URL (required for production)"
    echo "  POSTGRES_DB    Database name (default: afritec_lms)"
    echo "  POSTGRES_USER  Database user (default: postgres)"
    echo ""
    echo "Examples:"
    echo "  # Apply migration with backup"
    echo "  $0"
    echo ""
    echo "  # Apply migration without backup"
    echo "  $0 --no-backup"
    echo ""
    echo "  # For production with DATABASE_URL"
    echo "  DATABASE_URL='postgresql://user:pass@host:port/db' $0"
}

# Main execution
main() {
    local skip_backup=false
    local verify_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            --no-backup)
                skip_backup=true
                shift
                ;;
            --verify-only)
                verify_only=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting PostgreSQL migration deployment..."
    echo "======================================================="
    
    # Check prerequisites
    check_postgresql
    check_migration_file
    
    if [ "$verify_only" = true ]; then
        verify_migration
        exit 0
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Backup database (unless skipped)
    if [ "$skip_backup" = false ]; then
        backup_database
    fi
    
    # Apply migration
    apply_migration
    
    # Verify migration
    verify_migration
    
    echo "======================================================="
    print_success "PostgreSQL migration deployment completed successfully!"
    print_status "Next steps:"
    echo "  1. Update your application's DATABASE_URL to point to PostgreSQL"
    echo "  2. Test your application with the new database"
    echo "  3. Monitor for any issues"
    
    if [ "$skip_backup" = false ] && [ -d "$BACKUP_DIR" ]; then
        print_status "Backup files are available in: $BACKUP_DIR"
    fi
}

# Run main function
main "$@"