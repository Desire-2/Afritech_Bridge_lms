import { useState, useEffect } from 'react';
import { OpportunityService } from '@/services/opportunity.service';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Opportunity, CreateOpportunityRequest, PaginatedResponse } from '@/types/api';

export const useOpportunities = (params?: {
  page?: number;
  per_page?: number;
  opportunity_type?: string;
  search?: string;
}) => {
  const [data, setData] = useState<PaginatedResponse<Opportunity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await OpportunityService.getAllOpportunities(params);
      setData(response);
    } catch (err) {
      setError(ApiErrorHandler.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [params?.page, params?.per_page, params?.opportunity_type, params?.search]);

  const createOpportunity = async (opportunityData: CreateOpportunityRequest) => {
    try {
      const newOpportunity = await OpportunityService.createOpportunity(opportunityData);
      if (data) {
        setData(prev => ({
          ...prev!,
          data: [newOpportunity, ...prev!.data],
          total: prev!.total + 1,
        }));
      }
      return newOpportunity;
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  const updateOpportunity = async (opportunityId: number, opportunityData: Partial<CreateOpportunityRequest>) => {
    try {
      const updatedOpportunity = await OpportunityService.updateOpportunity(opportunityId, opportunityData);
      if (data) {
        setData(prev => ({
          ...prev!,
          data: prev!.data.map(opportunity => 
            opportunity.id === opportunityId ? updatedOpportunity : opportunity
          ),
        }));
      }
      return updatedOpportunity;
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  const deleteOpportunity = async (opportunityId: number) => {
    try {
      await OpportunityService.deleteOpportunity(opportunityId);
      if (data) {
        setData(prev => ({
          ...prev!,
          data: prev!.data.filter(opportunity => opportunity.id !== opportunityId),
          total: prev!.total - 1,
        }));
      }
    } catch (err) {
      throw ApiErrorHandler.handleError(err);
    }
  };

  return {
    opportunities: data?.data || [],
    pagination: data ? {
      total: data.total,
      page: data.page,
      per_page: data.per_page,
      total_pages: data.total_pages,
    } : null,
    loading,
    error,
    refetch: fetchOpportunities,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
  };
};

export const useOpportunity = (opportunityId: number) => {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunity = async () => {
    if (!opportunityId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await OpportunityService.getOpportunity(opportunityId);
      setOpportunity(data);
    } catch (err) {
      setError(ApiErrorHandler.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunity();
  }, [opportunityId]);

  return {
    opportunity,
    loading,
    error,
    refetch: fetchOpportunity,
  };
};