#!/bin/bash

# PostgreSQL Setup Script for Ubuntu/Debian
# This script sets up PostgreSQL with proper authentication for the migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to setup PostgreSQL
setup_postgresql() {
    print_status "Setting up PostgreSQL for migration..."
    
    # Get current username
    CURRENT_USER=$(whoami)
    DB_NAME="afritec_lms"
    
    print_status "Current user: $CURRENT_USER"
    print_status "Target database: $DB_NAME"
    
    # Create database and user as postgres
    print_status "Creating PostgreSQL user and database..."
    
    sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$CURRENT_USER') THEN
        CREATE USER $CURRENT_USER WITH PASSWORD 'password123';
        ALTER USER $CURRENT_USER CREATEDB;
        GRANT ALL PRIVILEGES ON DATABASE postgres TO $CURRENT_USER;
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $CURRENT_USER;
ALTER DATABASE $DB_NAME OWNER TO $CURRENT_USER;
EOF
    
    if [ $? -eq 0 ]; then
        print_success "PostgreSQL setup completed"
        print_status "Database: $DB_NAME"
        print_status "User: $CURRENT_USER"
        print_status "Password: password123"
    else
        print_error "PostgreSQL setup failed"
        exit 1
    fi
}

# Function to test connection
test_connection() {
    print_status "Testing PostgreSQL connection..."
    
    CURRENT_USER=$(whoami)
    DB_NAME="afritec_lms"
    
    # Test connection
    PGPASSWORD="password123" psql -U "$CURRENT_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Connection test successful"
        return 0
    else
        print_error "Connection test failed"
        return 1
    fi
}

# Function to set environment variables
set_environment() {
    print_status "Setting up environment variables..."
    
    CURRENT_USER=$(whoami)
    DB_NAME="afritec_lms"
    
    # Create environment file
    cat > .env.postgresql << EOF
# PostgreSQL Configuration for Migration
export POSTGRES_DB="$DB_NAME"
export POSTGRES_USER="$CURRENT_USER"
export POSTGRES_PASSWORD="password123"
export PGPASSWORD="password123"
export DATABASE_URL="postgresql://$CURRENT_USER:password123@localhost:5432/$DB_NAME"
EOF
    
    print_success "Environment configuration created: .env.postgresql"
    print_status "To use these settings, run: source .env.postgresql"
}

# Function to show usage
show_usage() {
    echo "PostgreSQL Setup for Afritec Bridge LMS Migration"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  setup     - Setup PostgreSQL user and database"
    echo "  test      - Test PostgreSQL connection"
    echo "  env       - Create environment configuration"
    echo "  all       - Run setup, test, and create env (default)"
    echo "  -h, --help - Show this help"
    echo ""
    echo "This script will:"
    echo "  1. Create a PostgreSQL user matching your system username"
    echo "  2. Create the 'afritec_lms' database"
    echo "  3. Set proper permissions"
    echo "  4. Test the connection"
    echo "  5. Create environment configuration"
}

# Main function
main() {
    local action="${1:-all}"
    
    case $action in
        setup)
            setup_postgresql
            ;;
        test)
            test_connection
            ;;
        env)
            set_environment
            ;;
        all)
            print_status "Running complete PostgreSQL setup..."
            setup_postgresql
            test_connection
            set_environment
            
            echo ""
            print_success "PostgreSQL setup complete!"
            print_status "Next steps:"
            echo "  1. Run: source .env.postgresql"
            echo "  2. Run: ./deploy_postgresql_migration.sh"
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            print_error "Unknown action: $action"
            show_usage
            exit 1
            ;;
    esac
}

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL is not installed. Please install it first:"
    echo "  sudo apt update"
    echo "  sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if ! sudo systemctl is-active --quiet postgresql; then
    print_warning "PostgreSQL is not running. Starting it..."
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

# Run main function
main "$@"