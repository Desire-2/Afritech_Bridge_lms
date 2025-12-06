"use client";

import React, { useState, useEffect } from 'react';

interface FormData {
  title: string;
  description: string;
  organization: string;
  location: string;
  opportunity_type: 'scholarship' | 'internship' | 'job' | 'fellowship' | 'grant' | 'other';
  application_deadline: string;
  requirements: string;
  benefits: string;
  application_url: string;
  contact_email: string;
}

interface OpportunityFormProps {
  opportunityId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const OpportunityForm: React.FC<OpportunityFormProps> = ({
  opportunityId,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    organization: '',
    location: '',
    opportunity_type: 'internship',
    application_deadline: '',
    requirements: '',
    benefits: '',
    application_url: '',
    contact_email: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (opportunityId) {
      setIsEditMode(true);
      const fetchOpportunity = async () => {
        try {
          setLoading(true);
          // This would call the API to fetch opportunity details
          // const response = await fetch(`/api/v1/admin/opportunities/${opportunityId}`);
          // const opportunity = await response.json();
          // setFormData(opportunity);
        } catch (err: any) {
          setError(`Failed to load opportunity: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchOpportunity();
    }
  }, [opportunityId]);

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Opportunity title is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    if (!formData.organization.trim()) {
      setError('Organization name is required');
      return false;
    }
    if (!formData.application_deadline) {
      setError('Application deadline is required');
      return false;
    }
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      setError('Invalid email format');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && opportunityId) {
        // Call update endpoint
        // await AdminService.updateOpportunity(opportunityId, formData);
        setSuccess('Opportunity updated successfully!');
      } else {
        // Call create endpoint
        // await AdminService.createOpportunity(formData);
        setSuccess('Opportunity created successfully!');
      }

      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setError(`Failed to save opportunity: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading && isEditMode) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEditMode ? 'Edit Opportunity' : 'Create New Opportunity'}
      </h1>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Opportunity Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Senior Software Engineer"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Organization <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            placeholder="Company or organization name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g., Lagos, Nigeria / Remote"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Opportunity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            name="opportunity_type"
            value={formData.opportunity_type}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="internship">Internship</option>
            <option value="job">Job</option>
            <option value="scholarship">Scholarship</option>
            <option value="fellowship">Fellowship</option>
            <option value="grant">Grant</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detailed description of the opportunity"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Requirements
          </label>
          <textarea
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            placeholder="Qualifications and requirements (one per line)"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Benefits */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Benefits
          </label>
          <textarea
            name="benefits"
            value={formData.benefits}
            onChange={handleChange}
            placeholder="Compensation, benefits, and perks (one per line)"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Application Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application Deadline <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="application_deadline"
            value={formData.application_deadline}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Application URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application URL
          </label>
          <input
            type="url"
            name="application_url"
            value={formData.application_url}
            onChange={handleChange}
            placeholder="https://example.com/apply"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contact Email
          </label>
          <input
            type="email"
            name="contact_email"
            value={formData.contact_email}
            onChange={handleChange}
            placeholder="contact@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-8 flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : isEditMode ? 'Update Opportunity' : 'Create Opportunity'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default OpportunityForm;
