"use client";

import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

// Placeholder for Opportunity type - define based on your actual Opportunity model
interface Opportunity {
  id: string;
  title: string;
  companyName: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Volunteer';
  deadline: string;
  postedAt: string;
}

// Placeholder data - replace with API calls
const placeholderOpportunities: Opportunity[] = [
  {
    id: 'opp001',
    title: 'Senior Frontend Developer',
    companyName: 'Innovatech Solutions',
    location: 'Remote',
    type: 'Full-time',
    deadline: '2024-06-30T23:59:59Z',
    postedAt: '2024-05-01T10:00:00Z',
  },
  {
    id: 'opp002',
    title: 'Data Science Internship',
    companyName: 'FutureAI Corp',
    location: 'New York, NY',
    type: 'Internship',
    deadline: '2024-05-31T23:59:59Z',
    postedAt: '2024-04-15T14:30:00Z',
  },
  {
    id: 'opp003',
    title: 'Part-time UX Designer',
    companyName: 'Creative Minds Agency',
    location: 'Remote (Global)',
    type: 'Part-time',
    deadline: '2024-06-15T23:59:59Z',
    postedAt: '2024-05-10T09:15:00Z',
  },
];

const OpportunityManagementPage = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/admin/opportunities
        // const response = await fetch('/api/admin/opportunities', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch opportunities');
        // const data = await response.json();
        // setOpportunities(data.opportunities);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setOpportunities(placeholderOpportunities);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching opportunities.');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, [authContext?.token]);

  const handleAddOpportunity = () => {
    console.log('Add new opportunity clicked');
    // Navigate to add opportunity page or open modal
  };

  const handleEditOpportunity = (opportunityId: string) => {
    console.log(`Edit opportunity ${opportunityId} clicked`);
    // Navigate to edit opportunity page or open modal
  };

  const handleDeleteOpportunity = (opportunityId: string) => {
    console.log(`Delete opportunity ${opportunityId} clicked`);
    // Show confirmation and call API
  };

  if (loading) return <div className="text-center py-10">Loading opportunities...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Opportunity Management</h1>
        <button
          onClick={handleAddOpportunity}
          className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"
        >
          Add New Opportunity
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted At</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No opportunities found.</td>
              </tr>
            ) : (
              opportunities.map((opp) => (
                <tr key={opp.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{opp.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{opp.companyName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{opp.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${opp.type === 'Full-time' ? 'bg-blue-100 text-blue-800' : opp.type === 'Internship' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {opp.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(opp.deadline).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(opp.postedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleEditOpportunity(opp.id)} className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                    <button onClick={() => handleDeleteOpportunity(opp.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* TODO: Add pagination */}
      {/* TODO: Add modals/forms for Add/Edit Opportunity */}
    </div>
  );
};

export default OpportunityManagementPage;

