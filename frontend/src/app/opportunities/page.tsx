'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Enhanced mock opportunity data 
const mockOpportunities = [
  {
    id: 1,
    title: "Software Engineering Internship",
    organization: "Tech Africa",
    location: "Lagos, Nigeria",
    type: "Internship",
    description: "Join our team as a software engineering intern and work on real-world projects that impact millions of users across Africa. Learn from senior developers and contribute to meaningful solutions.",
    deadline: "2025-11-15",
    requirements: "Computer Science student, Basic programming knowledge"
  },
  {
    id: 2,
    title: "Full Stack Developer Position",
    organization: "Innovation Hub",
    location: "Cape Town, South Africa",
    type: "Job",
    description: "We're looking for a passionate full-stack developer to help build the next generation of fintech solutions for African markets. Remote work available.",
    deadline: "2025-12-01",
    requirements: "3+ years experience, React, Node.js, Database skills"
  },
  {
    id: 3,
    title: "Google Africa Developer Scholarship",
    organization: "Google",
    location: "Remote",
    type: "Scholarship",
    description: "Free scholarship program for African developers to learn cloud technologies and gain industry certifications. Includes mentorship and career support.",
    deadline: "2025-10-30",
    requirements: "African resident, Basic programming knowledge"
  },
  {
    id: 4,
    title: "Frontend Developer Internship",
    organization: "StartupXYZ",
    location: "Nairobi, Kenya",
    type: "Internship",
    description: "Work with our design team to create beautiful, responsive user interfaces for our mobile and web applications.",
    deadline: "2025-11-20",
    requirements: "HTML, CSS, JavaScript knowledge, Design sense"
  },
  {
    id: 5,
    title: "Data Science Fellowship",
    organization: "African Data Initiative",
    location: "Remote",
    type: "Fellowship",
    description: "6-month fellowship program focusing on data science applications for social good across Africa. Includes stipend and mentorship.",
    deadline: "2025-12-15",
    requirements: "Statistics/Math background, Python, Research interest"
  },
  {
    id: 6,
    title: "Mobile App Developer",
    organization: "FinTech Solutions",
    location: "Accra, Ghana",
    type: "Job",
    description: "Build mobile applications that serve millions of users across West Africa. Focus on financial inclusion and payment solutions.",
    deadline: "2025-11-30",
    requirements: "React Native or Flutter, API integration, 2+ years experience"
  }
];

// Public Opportunity Card Component
const PublicOpportunityCard: React.FC<{ opportunity: any }> = ({ opportunity }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg overflow-hidden rounded-xl hover:shadow-xl transition-all duration-300">
    <div className="px-6 py-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {opportunity.title}
        </h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          opportunity.type === 'Job' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          opportunity.type === 'Internship' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
          opportunity.type === 'Scholarship' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }`}>
          {opportunity.type}
        </span>
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
        <span className="font-medium">{opportunity.organization}</span> • {opportunity.location}
      </p>
      
      <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 line-clamp-3">
        {opportunity.description}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Deadline: {new Date(opportunity.deadline).toLocaleDateString()}
        </span>
        <Link 
          href="/auth/login?redirect=/student/opportunities" 
          className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium text-sm"
        >
          Apply Now →
        </Link>
      </div>
    </div>
  </div>
);

const PublicOpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    // Simulate API call with mock data - fast loading for public pages
    const loadOpportunities = async () => {
      setIsLoading(true);
      try {
        // Quick load for better UX on public pages
        await new Promise(resolve => setTimeout(resolve, 800));
        setOpportunities(mockOpportunities);
      } catch (error) {
        console.error('Error loading opportunities:', error);
        setOpportunities(mockOpportunities); // Fallback to mock data
      } finally {
        setIsLoading(false);
      }
    };

    loadOpportunities();
  }, []);

  const filteredOpportunities = selectedType 
    ? opportunities.filter(opp => opp.type.toLowerCase() === selectedType.toLowerCase())
    : opportunities;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-white">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <svg 
                className="w-8 h-8 text-emerald-400"
                viewBox="0 0 64 64" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18Z" 
                  fill="currentColor"
                />
              </svg>
              <span className="text-xl font-bold text-white">Afritec Bridge</span>
            </Link>
            <Link 
              href="/auth/login" 
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Global Opportunities
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Connect with internships, jobs, scholarships, and other opportunities 
              designed to accelerate African tech talent globally.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-8">
            <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-2">
                Filter by Type
              </label>
              <select
                id="type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="block w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Types</option>
                <option value="job">Jobs</option>
                <option value="internship">Internships</option>
                <option value="scholarship">Scholarships</option>
                <option value="fellowship">Fellowships</option>
              </select>
            </div>
          </div>

          {/* Opportunities Grid */}
          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-4xl mb-4">🌍</div>
                <h3 className="text-xl font-semibold text-white mb-3">No Opportunities Found</h3>
                <p className="text-gray-300 mb-6">
                  {selectedType ? `No ${selectedType} opportunities available at the moment.` : 'No opportunities match your current filter.'}
                </p>
                <button 
                  onClick={() => setSelectedType('')}
                  className="px-6 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredOpportunities.map((opportunity) => (
                <PublicOpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          )}

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to Apply?</h2>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Join our platform to apply for opportunities, track your applications, 
                and connect with organizations looking for talented individuals like you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  href="/auth/register"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  Create Account
                </Link>
                <Link 
                  href="/auth/login"
                  className="inline-flex items-center px-6 py-3 border border-emerald-500 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 font-semibold rounded-lg transition-all duration-300"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicOpportunitiesPage;