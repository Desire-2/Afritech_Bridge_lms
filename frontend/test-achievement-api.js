// Quick test to check if API is accessible
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
console.log('Token found:', token ? 'YES' : 'NO');
console.log('Token preview:', token ? token.substring(0, 30) + '...' : 'none');
