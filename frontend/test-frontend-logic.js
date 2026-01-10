#!/usr/bin/env node

/**
 * Test frontend data processing logic with actual API data
 */

const axios = require('axios');

async function testFrontendLogic() {
  try {
    // Login
    const loginResponse = await axios.post('http://192.168.0.4:5001/api/v1/auth/login', {
      identifier: 'afritechbridge@yahoo.com',
      password: 'Desire@#1'
    });
    
    const { access_token } = loginResponse.data;
    
    // Get grading data
    const gradingResponse = await axios.get('http://192.168.0.4:5001/api/v1/grading/assignments/submissions?status=all', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const assignmentData = gradingResponse.data;
    console.log('Raw API Response:', JSON.stringify(assignmentData, null, 2));
    
    // Simulate frontend mapping logic
    const allItems = [];
    
    const mappedAssignments = assignmentData.submissions.map(sub => {
      const mapped = {
        id: sub.id,
        type: 'assignment',
        title: sub.assignment_title,
        course_title: sub.course_title,
        course_id: sub.course_id,
        student_name: sub.student_name,
        student_id: sub.student_id,
        submitted_at: sub.submitted_at,
        due_date: sub.due_date,
        days_late: sub.days_late,
        points_possible: sub.assignment_points,
        grade: sub.grade,
        graded_at: sub.graded_at,
        is_resubmission: sub.is_resubmission,
        resubmission_count: sub.resubmission_count,
        submission_notes: sub.submission_notes,
        modification_requested: sub.modification_requested,
        modification_request_reason: sub.modification_request_reason,
        modification_requested_at: sub.modification_requested_at,
        modification_requested_by: sub.modification_requested_by,
        can_resubmit: sub.can_resubmit
      };
      
      console.log(`Mapping assignment ${sub.id}: is_resubmission=${sub.is_resubmission} -> ${mapped.is_resubmission}`);
      return mapped;
    });
    
    allItems.push(...mappedAssignments);
    
    // Simulate frontend counting logic
    const counts = {
      pending: 0,
      resubmitted: 0,
      modification_requested: 0,
      graded: 0,
      overdue: 0
    };
    
    console.log('\n=== FRONTEND COUNTING SIMULATION ===');
    console.log('Starting status counting...');
    
    allItems.forEach((item, index) => {
      console.log(`Processing item ${index + 1}:`, {
        id: item.id,
        title: item.title?.substring(0, 30) + '...',
        grade: item.grade,
        is_resubmission: item.is_resubmission,
        modification_requested: item.modification_requested,
        type: typeof item.is_resubmission,
        resubmission_check: item.is_resubmission === true
      });

      // Priority order: resubmissions > modification_requested > graded > pending
      if (item.is_resubmission === true) {
        counts.resubmitted++;
        console.log(`  -> RESUBMITTED (total: ${counts.resubmitted})`);
      } else if (item.modification_requested === true) {
        counts.modification_requested++;
        console.log(`  -> MODIFICATION REQUESTED (total: ${counts.modification_requested})`);
      } else if (item.grade !== undefined && item.grade !== null) {
        counts.graded++;
        console.log(`  -> GRADED (total: ${counts.graded})`);
      } else {
        counts.pending++;
        console.log(`  -> PENDING (total: ${counts.pending})`);
      }
      
      if (item.days_late > 0) {
        counts.overdue++;
      }
    });
    
    console.log('\n=== FINAL STATUS COUNTS ===');
    console.log(`Pending: ${counts.pending}`);
    console.log(`Resubmitted: ${counts.resubmitted}`);
    console.log(`Modification Requested: ${counts.modification_requested}`);
    console.log(`Graded: ${counts.graded}`);
    console.log(`Overdue: ${counts.overdue}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  }
}

testFrontendLogic();