"use client";

// Simple test dashboard page without authentication
const TestDashboardPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Student Dashboard - Test Version
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            This is a test version of the student dashboard to verify routing is working.
          </p>
          <div className="mt-4 p-4 bg-green-100 rounded">
            <p className="text-green-800 font-semibold">
              ✅ Route /student/dashboard is working correctly!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestDashboardPage;