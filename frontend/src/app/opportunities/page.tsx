'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedLayout from "@/app/dashboard/layout"; // Assuming layout is in app/dashboard

// Define the shape of an opportunity object
interface Opportunity {
  id: number;
  title: string;
  description: string;
  company_name?: string;
  location?: string;
  opportunity_type?: string; // e.g., Job, Internship, Scholarship
  // Add other opportunity properties like application_deadline, application_link, etc.
}

// API base URL - should be in an environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const OpportunityCard: React.FC<{ opportunity: Opportunity }> = ({ opportunity }) => (
  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
    <div className="px-4 py-5 sm:px-6">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        <Link href={`/opportunities/${opportunity.id}`} className="hover:text-indigo-600">
          {opportunity.title}
        </Link>
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-gray-500">
        {opportunity.company_name && `${opportunity.company_name} - `}{opportunity.location || 'Remote'}
      </p>
      {opportunity.opportunity_type && (
        <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {opportunity.opportunity_type}
        </span>
      )}
    </div>
    <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
      <p className="text-sm text-gray-700 line-clamp-3">{opportunity.description}</p>
      <div className="mt-4">
        <Link href={`/opportunities/${opportunity.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View Details &rarr;
        </Link>
      </div>
    </div>
  </div>
);

const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/opportunities`);
        if (!response.ok) {
          throw new Error('Failed to fetch opportunities');
        }
        const data = await response.json();
        setOpportunities(data.opportunities || data); // Adjust based on your API response structure
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading opportunities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-600">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ProtectedLayout>
    <div className="bg-gray-100 min-h-screen">
      {/* <Header /> */}
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              Global Opportunities
            </h1>
            <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
              Connect with internships, jobs, scholarships, and other opportunities for innovators.
            </p>
          </div>

          {/* Add Filters and Search Bar here later */}

          {opportunities.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-lg text-gray-600">No opportunities available at the moment. Please check back later.</p>
            </div>
          ) : (
            <div className="mt-12 max-w-lg mx-auto grid gap-5 lg:grid-cols-3 lg:max-w-none">
              {opportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          )}
        </div>
      </main>
      {/* <Footer /> */}
    </div>
    </ProtectedLayout>
  );
};

export default OpportunitiesPage;

