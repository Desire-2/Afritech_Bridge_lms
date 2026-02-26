#!/bin/bash
# Quick Setup Script for Payment Reminder System

echo "🚀 Setting up Payment Reminder System..."
echo ""

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x run_payment_reminders.py
chmod +x migrate_add_payment_reminder_fields.py

# Run migration
echo "📊 Running database migration..."
python migrate_add_payment_reminder_fields.py

# Test dry run
echo "🧪 Testing scheduler (dry run)..."
python run_payment_reminders.py --dry-run

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review the output above"
echo "2. Set up cron job (see PAYMENT_REMINDER_SETUP.md)"
echo "3. Monitor logs/payment_reminders.log"
echo ""
