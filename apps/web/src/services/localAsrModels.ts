import { apiService, type ApiResponse } from './api'

export type LocalAsrModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'failed'

export interface LocalAsrModel {
  id: string
  model_id?: string
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
    const payload = (response.data ?? response) as Omit<LocalAsrModelListResponse, 'models' | 'active_model'> & {
      models: Array<LocalAsrModel & { model_id?: string; download_state?: string }>
      active_model: LocalAsrModel & { model_id?: string; download_state?: string }
    }

    const mapStatus = (model: LocalAsrModel & { model_id?: string; download_state?: string }): LocalAsrModelStatus => {
      const raw = model.status || model.download_state
      if (raw === 'ready' || raw === 'downloading' || raw === 'failed' || raw === 'not_downloaded') {
        return raw
      }
      return model.ready ? 'ready' : 'not_downloaded'
    }

    return {
      ...payload,
      models: (payload.models || []).map(model => ({
        ...model,
        id: model.id || model.model_id || '',
        status: mapStatus(model),
      })),
      active_model: {
        ...payload.active_model,
        id: payload.active_model?.id || payload.active_model?.model_id || '',
        status: mapStatus(payload.active_model),
      },
    }
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
