#!/bin/bash
# Check quiz questions for course 7 using SQLite

BACKEND_DIR="/home/desire/My_Project/AB/afritec_bridge_lms/backend"
DB_FILE="$BACKEND_DIR/instance/afritec_lms_db.db"

if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database file not found at: $DB_FILE"
    exit 1
fi

echo "================================================================================"
echo "CHECKING QUIZ QUESTIONS FOR COURSE 7"
echo "================================================================================"

sqlite3 "$DB_FILE" << EOF

-- Get course info
.headers on
.mode column

SELECT '1. COURSE INFO' as SECTION;
SELECT id, title, instructor_id FROM courses WHERE id = 7;

SELECT '2. QUIZZES IN COURSE 7' as SECTION;
SELECT id, title, is_published FROM quizzes WHERE course_id = 7;

SELECT '3. QUESTIONS PER QUIZ' as SECTION;
SELECT 
  q.id as quiz_id,
  q.title as quiz_title,
  COUNT(qn.id) as question_count
FROM quizzes q
LEFT JOIN questions qn ON q.id = qn.quiz_id
WHERE q.course_id = 7
GROUP BY q.id, q.title;

SELECT '4. ALL QUESTIONS IN COURSE 7' as SECTION;
SELECT 
  q.id as question_id,
  qz.id as quiz_id,
  qz.title as quiz_title,
  q.text as question_text,
  q.question_type,
  q.order
FROM questions q
JOIN quizzes qz ON q.quiz_id = qz.id
WHERE qz.course_id = 7
ORDER BY qz.id, q.order;

SELECT '5. ALL ANSWERS FOR QUESTIONS' as SECTION;
SELECT 
  a.id as answer_id,
  a.question_id,
  q.text as question_text,
  a.text as answer_text,
  CASE WHEN a.is_correct = 1 THEN 'YES' ELSE 'NO' END as is_correct
FROM answers a
JOIN questions q ON a.question_id = q.id
JOIN quizzes qz ON q.quiz_id = qz.id
WHERE qz.course_id = 7
ORDER BY q.quiz_id, q.id, a.id;

SELECT '6. SUMMARY' as SECTION;
SELECT 
  COUNT(DISTINCT qz.id) as total_quizzes,
  COUNT(DISTINCT q.id) as total_questions,
  COUNT(DISTINCT a.id) as total_answers
FROM quizzes qz
LEFT JOIN questions q ON qz.id = q.quiz_id
LEFT JOIN answers a ON q.id = a.question_id
WHERE qz.course_id = 7;

EOF

echo ""
echo "================================================================================"
echo "Database check complete"
echo "================================================================================"
