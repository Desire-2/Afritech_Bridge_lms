/**
 * Instructor Settings Service for Afritec Bridge LMS Frontend
 * Manages AI provider API keys and settings for instructors
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

export interface AISettingItem {
  key: string;
  value: string;
  data_type: string;
  description: string;
  is_editable: boolean;
  has_value: boolean;
}

export interface ProviderStats {
  available: boolean;
  failure_count: number;
  is_cooling_down: boolean;
  requests_this_minute: number;
  rpm_limit: number;
}

export interface AIProviderResponse {
  success: boolean;
  data: {
    settings: Record<string, AISettingItem>;
    provider_stats: {
      openrouter: ProviderStats;
      gemini: ProviderStats;
      current_provider: string;
    };
  };
}

class InstructorSettingsService {
  private static readonly BASE_PATH = '/instructor/settings';

  /**
   * Get AI provider settings (API keys are masked for security)
   */
  async getAISettings(): Promise<AIProviderResponse> {
    try {
      const response = await apiClient.get(`${InstructorSettingsService.BASE_PATH}/ai`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update AI provider settings (API keys, enable/disable flags)
   */
  async updateAISettings(
    settings: Record<string, any>
  ): Promise<{
    success: boolean;
    message: string;
    data: { updated: string[]; errors: string[] };
  }> {
    try {
      const response = await apiClient.put(`${InstructorSettingsService.BASE_PATH}/ai`, {
        settings,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Test AI provider connection
   */
  async testAIConnection(
    provider: 'openrouter' | 'gemini'
  ): Promise<{
    success: boolean;
    message: string;
    provider_used?: string;
    response?: string;
  }> {
    try {
      const response = await apiClient.post(`${InstructorSettingsService.BASE_PATH}/ai/test`, {
        provider,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Activate the current user's AI provider context.
   * Loads the user's personal API keys and model names into the AI provider
   * manager so subsequent AI requests use their credentials.
   */
  async activateAIContext(): Promise<{
    success: boolean;
    message: string;
    data?: {
      active_user_id: number;
      has_personal_keys: boolean;
      active_provider: string;
      provider_stats: {
        openrouter: ProviderStats;
        gemini: ProviderStats;
      };
      model_names: {
        openrouter_model_name: string;
        gemini_model_name: string;
      };
    };
  }> {
    try {
      const response = await apiClient.post(`${InstructorSettingsService.BASE_PATH}/ai/activate`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export const instructorSettingsService = new InstructorSettingsService();
export default instructorSettingsService;
