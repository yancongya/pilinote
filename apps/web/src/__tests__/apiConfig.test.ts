import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiBaseUrl, getApiUrl, getLocalImageUrl, getWebSocketUrl } from '../config/api'

describe('API base configuration', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_WS_BASE_URL', '')
    vi.stubEnv('PROD', false)
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses loopback IPv4 for localhost and IPv6 loopback in development', () => {
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:8000')
    vi.stubGlobal('window', { location: { hostname: '::1' } })
    expect(getApiBaseUrl()).toBe('http://127.0.0.1:8000')
  })

  it('keeps the LAN hostname in development', () => {
    vi.stubGlobal('window', { location: { hostname: '192.168.1.20' } })
    expect(getApiBaseUrl()).toBe('http://192.168.1.20:8000')
  })

  it('uses the environment base and strips trailing slashes', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/backend///')
    expect(getApiBaseUrl()).toBe('https://api.example.test/backend')
    expect(getApiUrl('/api/health')).toBe('https://api.example.test/backend/api/health')
  })

  it('prioritizes runtime configuration over the environment and production mode', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://environment.example.test')
    vi.stubEnv('PROD', true)
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      __PILINOTE_RUNTIME__: { apiBaseUrl: 'https://runtime.example.test///' },
    })
    expect(getApiBaseUrl()).toBe('https://runtime.example.test')
  })

  it('uses relative API paths in production without overrides', () => {
    vi.stubEnv('PROD', true)
    expect(getApiBaseUrl()).toBe('')
    expect(getApiUrl('/api/health')).toBe('/api/health')
  })

  it('keeps environment overrides in production without a window', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
    vi.stubGlobal('window', undefined)
    expect(getApiBaseUrl()).toBe('https://api.example.test')
  })

  it('preserves the local image endpoint and encoded file path', () => {
    expect(getLocalImageUrl('file:///downloads/video/frame #1.png')).toBe(
      'http://127.0.0.1:8000/api/library/image?file_path=%2Fdownloads%2Fvideo%2Fframe%20%231.png',
    )
  })

  it('prioritizes runtime WebSocket configuration, then environment, then hostname', () => {
    expect(getWebSocketUrl()).toBe('ws://127.0.0.1:8000/ws/queue')
    vi.stubEnv('VITE_WS_BASE_URL', 'wss://environment.example.test///')
    expect(getWebSocketUrl('/ws/test')).toBe('wss://environment.example.test/ws/test')
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      __PILINOTE_RUNTIME__: { wsBaseUrl: 'wss://runtime.example.test/' },
    })
    expect(getWebSocketUrl('/ws/test')).toBe('wss://runtime.example.test/ws/test')
  })
  it('uses the same production origin and port for WebSocket', () => {
    vi.stubEnv('PROD', true)
    vi.stubGlobal('window', { location: { hostname: 'nas.example', host: 'nas.example:8080', protocol: 'http:' } })
    expect(getWebSocketUrl()).toBe('ws://nas.example:8080/ws/queue')
    vi.stubGlobal('window', { location: { hostname: 'nas.example', host: 'nas.example', protocol: 'https:' } })
    expect(getWebSocketUrl()).toBe('wss://nas.example/ws/queue')
  })

})
