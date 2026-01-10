// Test script to debug the API authentication and data flow
const axios = require('axios');

const API_BASE = 'http://192.168.0.4:5001/api/v1';

async function testLogin() {
  try {
    console.log('Attempting to login...');
    const response = await axios.post(`${API_BASE}/auth/login`, {
      identifier: 'afritechbridge@yahoo.com', // Instructor email
      password: 'password123' // Default password
    });
    
    console.log('Login successful!');
    const { access_token } = response.data;
    console.log('Access token received:', access_token.substring(0, 50) + '...');
    
    // Now test the grading API
    console.log('\nTesting grading API...');
    const gradingResponse = await axios.get(`${API_BASE}/grading/assignments/submissions?status=all`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Grading API Response:');
    console.log(`Total submissions: ${gradingResponse.data.submissions.length}`);
    
    // Count by status
    const counts = {
      pending: 0,
      resubmitted: 0,
      modification_requested: 0,
      graded: 0
    };
    
    gradingResponse.data.submissions.forEach(sub => {
      if (sub.grade !== null && sub.grade !== undefined) {
        counts.graded++;
      } else if (sub.is_resubmission) {
        counts.resubmitted++;
      } else if (sub.modification_requested) {
        counts.modification_requested++;
      } else {
        counts.pending++;
      }
    });
    
    console.log('Status counts:', counts);
    
    // Show first few submissions for debugging
    console.log('\nFirst 3 submissions:');
    gradingResponse.data.submissions.slice(0, 3).forEach((sub, index) => {
      console.log(`${index + 1}. ID: ${sub.id}, Student: ${sub.student_name}, Assignment: ${sub.assignment_title}`);
      console.log(`   Resubmission: ${sub.is_resubmission}, Modification requested: ${sub.modification_requested}, Grade: ${sub.grade}`);
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLogin();