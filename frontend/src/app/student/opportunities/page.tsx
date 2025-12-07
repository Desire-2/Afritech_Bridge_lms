'use client';
import { useEffect } from "react";

const OpportunitiesPage = () => {
  useEffect(() => {
    // Redirect to external jobs site
    window.location.href = 'http://jobs.afritechbridge.online/';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg text-gray-600">Redirecting to job opportunities...</p>
      </div>
    </div>
  );
};

export default OpportunitiesPage;
