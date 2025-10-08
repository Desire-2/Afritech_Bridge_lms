"use client";

import { useState, useEffect } from 'react';
import { AuthService } from '@/services/auth.service';
import { CourseService } from '@/services/course.service';
import { OpportunityService } from '@/services/opportunity.service';

const ApiTestPage = () => {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const runApiTests = async () => {
    setLoading(true);
    const results: Record<string, any> = {};

    // Test 1: Basic API Health Check
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}` || 'http://192.168.133.116:5001');
      results.healthCheck = {
        status: response.status,
        success: response.ok,
        message: response.ok ? 'Backend is accessible' : 'Backend not responding'
      };
    } catch (error) {
      results.healthCheck = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Courses endpoint (without auth)
    try {
      const courses = await CourseService.getAllCourses();
      results.coursesEndpoint = {
        success: true,
        count: courses.length,
        message: `Retrieved ${courses.length} courses`
      };
    } catch (error: any) {
      results.coursesEndpoint = {
        success: false,
        error: error.message,
        status: error.status
      };
    }

    // Test 3: Opportunities endpoint (without auth)
    try {
      const opportunities = await OpportunityService.getAllOpportunities();
      results.opportunitiesEndpoint = {
        success: true,
        count: opportunities.data?.length || 0,
        message: `Retrieved ${opportunities.data?.length || 0} opportunities`
      };
    } catch (error: any) {
      results.opportunitiesEndpoint = {
        success: false,
        error: error.message,
        status: error.status
      };
    }

    // Test 4: Auth endpoint (register - should fail without proper data but endpoint should respond)
    try {
      await AuthService.register({
        username: 'test',
        email: 'test@test.com',
        password: 'testpassword123'
      });
      results.authEndpoint = {
        success: true,
        message: 'Auth endpoint responded (unexpected success)'
      };
    } catch (error: any) {
      // We expect this to fail, but we want to see the response
      results.authEndpoint = {
        success: error.status ? true : false, // If we get a status, the endpoint is working
        error: error.message,
        status: error.status,
        message: error.status ? 'Auth endpoint is responsive' : 'Auth endpoint unreachable'
      };
    }

    setTestResults(results);
    setLoading(false);
  };

  useEffect(() => {
    runApiTests();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Integration Test</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Testing connection to backend at: {process.env.NEXT_PUBLIC_API_URL || 'http://192.168.133.116:5001/api/v1'}
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={runApiTests}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
        >
          {loading ? 'Running Tests...' : 'Run API Tests'}
        </button>

        {Object.entries(testResults).map(([testName, result]) => (
          <div
            key={testName}
            className={`p-4 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
            }`}
          >
            <div className="flex items-center mb-2">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  result.success ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                {testName.replace(/([A-Z])/g, ' $1').trim()}
              </h3>
            </div>

            <div className="ml-6 space-y-1">
              {result.message && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {result.message}
                </p>
              )}

              {result.status && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status: {result.status}
                </p>
              )}

              {result.count !== undefined && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Count: {result.count}
                </p>
              )}

              {result.error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error: {result.error}
                </p>
              )}

              <details className="text-xs text-gray-500 dark:text-gray-500">
                <summary className="cursor-pointer">Raw Result</summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(testResults).length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Click "Run API Tests" to test the backend connection
        </div>
      )}
    </div>
  );
};

export default ApiTestPage;