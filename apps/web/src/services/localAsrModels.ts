import { apiService, type ApiResponse } from './api'

export type LocalAsrModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'failed'

export interface LocalAsrModel {
  id: string
  name: string
  repo_id: string
  estimated_size_mb: number
  path: string
  ready: boolean
  active: boolean
  status: LocalAsrModelStatus
  progress: number
  downloaded_bytes: number
  total_bytes: number
  error?: string | null
}

export interface LocalAsrModelListResponse {
  success: boolean
  message?: string
  active_model_id: string
  models: LocalAsrModel[]
  active_model: LocalAsrModel
  ready: boolean
}

export interface LocalAsrReadyResponse {
  success: boolean
  ready: boolean
  model_id: string
}

export const localAsrModelService = {
  async listModels(): Promise<LocalAsrModelListResponse> {
    const response = await apiService.request<LocalAsrModelListResponse>('/api/ai/asr/models', {
      method: 'GET',
    })
    return (response.data ?? response) as LocalAsrModelListResponse
  },

  async getModelStatus(modelId: string): Promise<ApiResponse<{ model: LocalAsrModel }>> {
    return apiService.request<{ model: LocalAsrModel }>(`/api/ai/asr/models/${encodeURIComponent(modelId)}`, {
      method: 'GET',
    })
  },

  async downloadModel(modelId: string): Promise<ApiResponse<{ model: LocalAsrModel }>> {
    return apiService.request<{ model: LocalAsrModel }>(`/api/ai/asr/models/${encodeURIComponent(modelId)}/download`, {
      method: 'POST',
    })
  },

  async deleteModel(modelId: string): Promise<ApiResponse<{ model: LocalAsrModel }>> {
    return apiService.request<{ model: LocalAsrModel }>(`/api/ai/asr/models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE',
    })
  },

  async setActiveModel(modelId: string): Promise<ApiResponse<{ model: LocalAsrModel }>> {
    return apiService.request<{ model: LocalAsrModel }>('/api/ai/asr/models/active', {
      method: 'PUT',
      body: JSON.stringify({ model_id: modelId }),
    })
  },

  async checkReady(modelId?: string): Promise<LocalAsrReadyResponse> {
    const query = modelId ? `?model_id=${encodeURIComponent(modelId)}` : ''
    const response = await apiService.request<LocalAsrReadyResponse>(`/api/ai/asr/readiness${query}`, {
      method: 'GET',
    })
    return (response.data ?? response) as LocalAsrReadyResponse
  },
}
