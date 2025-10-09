import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import {
  Opportunity,
  CreateOpportunityRequest,
  PaginatedResponse,
} from '@/types/api';

export class OpportunityService {
  private static readonly BASE_PATH = '/v1/opportunities';

  static async getAllOpportunities(params?: {
    page?: number;
    per_page?: number;
    opportunity_type?: string;
    search?: string;
  }): Promise<PaginatedResponse<Opportunity>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.opportunity_type) searchParams.set('opportunity_type', params.opportunity_type);
      if (params?.search) searchParams.set('search', params.search);

      const url = searchParams.toString() 
        ? `${this.BASE_PATH}?${searchParams.toString()}`
        : this.BASE_PATH;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getOpportunity(opportunityId: number): Promise<Opportunity> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${opportunityId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createOpportunity(opportunityData: CreateOpportunityRequest): Promise<Opportunity> {
    try {
      const response = await apiClient.post(this.BASE_PATH, opportunityData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateOpportunity(opportunityId: number, opportunityData: Partial<CreateOpportunityRequest>): Promise<Opportunity> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${opportunityId}`, opportunityData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteOpportunity(opportunityId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${opportunityId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getOpportunityTypes(): Promise<string[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/types`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async searchOpportunities(query: string, filters?: {
    opportunity_type?: string;
    location?: string;
    organization?: string;
  }): Promise<Opportunity[]> {
    try {
      const searchParams = new URLSearchParams({ search: query });
      if (filters?.opportunity_type) searchParams.set('opportunity_type', filters.opportunity_type);
      if (filters?.location) searchParams.set('location', filters.location);
      if (filters?.organization) searchParams.set('organization', filters.organization);

      const response = await apiClient.get(`${this.BASE_PATH}/search?${searchParams.toString()}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}