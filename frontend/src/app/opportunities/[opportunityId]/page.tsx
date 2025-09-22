'use client';
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation"; // For accessing route parameters
import Link from "next/link";

// Define the shape of an opportunity object (can be more detailed)
interface Opportunity {
  id: number;
  title: string;
  description: string;
  long_description?: string; // Assuming a more detailed description field
  company_name?: string;
  location?: string;
  opportunity_type?: string; // e.g., Job, Internship, Scholarship
  application_deadline?: string;
  application_link?: string;
  // Add other relevant fields like date_posted, requirements, etc.
}

// API base URL - should be in an environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) => (
  <a // Changed to <a> for external links like application_link, can be a button styled as link too
    {...props}
    className={`inline-block px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
      props.variant === "secondary"
        ? "text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
        : "text-white bg-indigo-600 hover:bg-indigo-700"
    } ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  />
);

const OpportunityDetailPage: React.FC = () => {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const opportunityId = params?.opportunityId as string; // opportunityId from folder name [opportunityId]

  useEffect(() => {
    if (!opportunityId) {
      setError("Opportunity ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchOpportunityDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/opportunities/${opportunityId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Opportunity not found.");
          } else {
            throw new Error("Failed to fetch opportunity details.");
          }
        }
        const data = await response.json();
        setOpportunity(data); // Assuming API returns the opportunity object directly
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpportunityDetails();
  }, [opportunityId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading opportunity details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-600 text-xl">Error: {error}</p>
        <Link href="/opportunities" className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Back to Opportunities
        </Link>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Opportunity not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* <Header /> */}
      <main className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h1 className="text-3xl font-bold text-gray-900">{opportunity.title}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {opportunity.company_name && (
                  <span className="font-medium">{opportunity.company_name}</span>
                )}
                {opportunity.location && (
                  <span className="ml-2">({opportunity.location})</span>
                )}
              </p>
              {opportunity.opportunity_type && (
                <span className="mt-2 inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {opportunity.opportunity_type}
                </span>
              )}
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">Opportunity Details</h2>
              <div className="prose max-w-none text-gray-700 whitespace-pre-wrap mb-6">
                {opportunity.long_description || opportunity.description}
              </div>

              {opportunity.application_deadline && (
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Application Deadline:</strong> {new Date(opportunity.application_deadline).toLocaleDateString()}
                </p>
              )}

              {opportunity.application_link && (
                <div className="mt-6">
                  <Button 
                    href={opportunity.application_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    variant="primary"
                  >
                    Apply Now
                  </Button>
                </div>
              )}

              <div className="mt-8">
                <Link href="/opportunities" className="text-indigo-600 hover:text-indigo-500">
                  &larr; Back to all opportunities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
};

export default OpportunityDetailPage;

