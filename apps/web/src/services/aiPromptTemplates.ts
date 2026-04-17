import { apiService } from './api'

export interface PromptTemplateResponse {
  success: boolean
  templates: Record<string, any>
  message?: string
}

export const aiPromptTemplatesService = {
  async getTemplates(): Promise<PromptTemplateResponse> {
    const response = await apiService.request<PromptTemplateResponse>('/api/ai/prompt-templates', {
      method: 'GET',
    })
    return (response.data || response) as PromptTemplateResponse
  },

  async getDefaultTemplates(): Promise<PromptTemplateResponse> {
    const response = await apiService.request<PromptTemplateResponse>('/api/ai/prompt-templates/defaults', {
      method: 'GET',
    })
    return (response.data || response) as PromptTemplateResponse
  },

  async getOverrideTemplates(): Promise<PromptTemplateResponse> {
    const response = await apiService.request<PromptTemplateResponse>('/api/ai/prompt-templates/override', {
      method: 'GET',
    })
    return (response.data || response) as PromptTemplateResponse
  },

  async saveTemplates(templates: Record<string, any>): Promise<PromptTemplateResponse> {
    const response = await apiService.request<PromptTemplateResponse>('/api/ai/prompt-templates', {
      method: 'PUT',
      body: JSON.stringify({ templates }),
    })
    return (response.data || response) as PromptTemplateResponse
  },

  async resetTemplates(): Promise<PromptTemplateResponse> {
    const response = await apiService.request<PromptTemplateResponse>('/api/ai/prompt-templates/reset', {
      method: 'POST',
    })
    return (response.data || response) as PromptTemplateResponse
  },
}
