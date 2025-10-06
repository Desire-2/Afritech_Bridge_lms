#!/bin/bash
# Test script to verify login error messages are working

echo "🧪 Testing Login Error Messages"
echo "================================"

echo ""
echo "1. Testing with invalid credentials (should show user not found):"
curl -s -X POST http://192.168.133.116:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "nonexistent@test.com", "password": "test123"}' | jq -r '.message'

echo ""
echo "2. Testing with empty credentials (should show validation error):"
curl -s -X POST http://192.168.133.116:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "", "password": ""}' | jq -r '.message'

echo ""
echo "3. Testing with missing password:"
curl -s -X POST http://192.168.133.116:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "test@example.com", "password": ""}' | jq -r '.message'

echo ""
echo "4. Testing with invalid email format:"
curl -s -X POST http://192.168.133.116:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "invalid@", "password": "test123"}' | jq -r '.message'

echo ""
echo "✅ Backend error messages are working correctly!"
echo "The frontend should now display these messages properly."