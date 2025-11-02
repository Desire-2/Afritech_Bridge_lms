#!/bin/bash
# Test the overview API endpoint to verify questions are returned

echo "Testing GET /instructor/assessments/courses/7/overview"
echo "==========================================================="
echo ""

# Make API request and format JSON nicely
curl -s \
  -H "Accept: application/json" \
  http://localhost:5001/api/v1/instructor/assessments/courses/7/overview | jq '.' | head -100

echo ""
echo "==========================================================="
echo "Above response should include:"
echo "  1. quizzes array with 6 items"
echo "  2. Each quiz should have 'questions' array"
echo "  3. Quiz ID 3 should have ~37 questions"
echo ""
