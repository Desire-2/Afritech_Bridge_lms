#!/usr/bin/env node

/**
 * Test script to verify frontend authentication and grading API
 */

const axios = require('axios');

const BASE_URL = 'http://192.168.0.4:5001/api/v1';

async function testAuthFlow() {
  try {
    console.log('🔐 Testing authentication flow...');
    
    // 1. Login
    console.log('1. Attempting login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'afritechbridge@yahoo.com',
      password: 'Desire@#1'
    });
    
    if (loginResponse.status === 200) {
      console.log('✅ Login successful!');
      const { access_token, user } = loginResponse.data;
      console.log(`   User: ${user.first_name} ${user.last_name}`);
      console.log(`   Role: ${user.role}`);
      
      // 2. Test grading API
      console.log('\n2. Testing grading API...');
      const gradingResponse = await axios.get(`${BASE_URL}/grading/assignments/submissions?status=all`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (gradingResponse.status === 200) {
        console.log('✅ Grading API successful!');
        const { submissions, analytics } = gradingResponse.data;
        console.log(`   Found ${submissions.length} submissions`);
        
        // Count statuses
        const statusCounts = {
          resubmitted: submissions.filter(s => s.is_resubmission).length,
          modification_requested: submissions.filter(s => s.modification_requested).length,
          graded: submissions.filter(s => s.grade !== null && s.grade !== undefined).length,
          pending: 0
        };
        statusCounts.pending = submissions.length - statusCounts.resubmitted - statusCounts.modification_requested - statusCounts.graded;
        
        console.log('\n📊 Status Summary:');
        console.log(`   🔄 Resubmitted: ${statusCounts.resubmitted}`);
        console.log(`   ✏️  Modification Requested: ${statusCounts.modification_requested}`);
        console.log(`   ✅ Graded: ${statusCounts.graded}`);
        console.log(`   ⏳ Pending: ${statusCounts.pending}`);
        
        if (submissions.length > 0) {
          console.log('\n🔍 Sample submission:');
          const sample = submissions[0];
          console.log(`   Title: ${sample.assignment_title}`);
          console.log(`   Student: ${sample.student_name}`);
          console.log(`   Is Resubmission: ${sample.is_resubmission}`);
          console.log(`   Modification Requested: ${sample.modification_requested}`);
          if (sample.modification_request_reason) {
            console.log(`   Modification Reason: ${sample.modification_request_reason.substring(0, 50)}...`);
          }
        }
        
        console.log('\n🎉 All tests passed! Frontend should be able to display data correctly.');
        
      } else {
        console.log('❌ Grading API failed:', gradingResponse.status, gradingResponse.statusText);
      }
      
    } else {
      console.log('❌ Login failed:', loginResponse.status, loginResponse.statusText);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
}

// Run the test
testAuthFlow();