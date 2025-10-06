const axios = require('axios');

async function testLoginFlow() {
  console.log('Testing login flow...');
  
  try {
    console.log('Making request to backend...');
    const response = await axios.post('http://192.168.133.116:5001/api/v1/auth/login', {
      identifier: 'invalid@email.com',
      password: 'wrongpassword'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Unexpected success:', response.data);
  } catch (error) {
    console.log('Expected error caught:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log('Headers:', error.response?.headers);
    
    // Test how our error handler would process this
    const errorData = error.response?.data;
    if (errorData?.error_type === 'authentication_error' && errorData?.details?.user_not_found) {
      console.log('✅ This should show: "No account found with this email or username. Please check your credentials or create a new account."');
    }
  }
}

testLoginFlow();