// ========== 错误类型定义 ==========

// 基础错误类型
export enum ErrorCategory {
  NETWORK = 'network',              // 网络相关错误
  AUTHENTICATION = 'authentication', // 认证相关错误
  AUTHORIZATION = 'authorization',   // 授权相关错误
  FILE_SYSTEM = 'file_system',      // 文件系统错误
  SERVER = 'server',                // 服务器错误
  CLIENT = 'client',                // 客户端错误
  TIMEOUT = 'timeout',              // 超时错误
  RATE_LIMIT = 'rate_limit',        // 速率限制
  VALIDATION = 'validation',        // 验证错误
  UNKNOWN = 'unknown'               // 未知错误
}

// 网络错误子类型
export enum NetworkErrorType {
  CONNECTION_FAILED = 'connection_failed',
  DNS_RESOLUTION_FAILED = 'dns_resolution_failed',
  SSL_ERROR = 'ssl_error',
  PROXY_ERROR = 'proxy_error',
  CONNECTION_REFUSED = 'connection_refused',
  CONNECTION_RESET = 'connection_reset',
  NETWORK_UNREACHABLE = 'network_unreachable',
  HOST_UNREACHABLE = 'host_unreachable'
}

// 认证错误子类型
export enum AuthenticationErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SESSION_EXPIRED = 'session_expired',
  COOKIE_INVALID = 'cookie_invalid',
  LOGIN_REQUIRED = 'login_required',
  ACCOUNT_BANNED = 'account_banned',
  ACCOUNT_DELETED = 'account_deleted'
}

// 授权错误子类型
export enum AuthorizationErrorType {
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  RESOURCE_NOT_OWNED = 'resource_not_owned',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  REGION_RESTRICTED = 'region_restricted',
  AGE_RESTRICTED = 'age_restricted',
  VIP_REQUIRED = 'vip_required'
}

// 文件系统错误子类型
export enum FileSystemErrorType {
  DISK_FULL = 'disk_full',
  PERMISSION_DENIED = 'permission_denied',
  FILE_NOT_FOUND = 'file_not_found',
  FILE_EXISTS = 'file_exists',
  PATH_TOO_LONG = 'path_too_long',
  INVALID_PATH = 'invalid_path',
  FILE_LOCKED = 'file_locked',
  QUOTA_EXCEEDED = 'quota_exceeded'
}

// 服务器错误子类型
export enum ServerErrorType {
  INTERNAL_SERVER_ERROR = 'internal_server_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  BAD_GATEWAY = 'bad_gateway',
  GATEWAY_TIMEOUT = 'gateway_timeout',
  MAINTENANCE_MODE = 'maintenance_mode',
  OVERLOADED = 'overloaded'
}

// 客户端错误子类型
export enum ClientErrorType {
  INVALID_REQUEST = 'invalid_request',
  MISSING_PARAMETER = 'missing_parameter',
  INVALID_PARAMETER = 'invalid_parameter',
  UNSUPPORTED_MEDIA_TYPE = 'unsupported_media_type',
  PAYLOAD_TOO_LARGE = 'payload_too_large',
  VERSION_MISMATCH = 'version_mismatch'
}

// 超时错误子类型
export enum TimeoutErrorType {
  CONNECTION_TIMEOUT = 'connection_timeout',
  READ_TIMEOUT = 'read_timeout',
  WRITE_TIMEOUT = 'write_timeout',
  DNS_TIMEOUT = 'dns_timeout'
}

// 验证错误子类型
export enum ValidationErrorType {
  INVALID_URL = 'invalid_url',
  INVALID_MEDIA_ID = 'invalid_media_id',
  INVALID_QUALITY = 'invalid_quality',
  INVALID_FORMAT = 'invalid_format',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  CONSTRAINT_VIOLATION = 'constraint_violation'
}

// 错误严重级别
export enum ErrorSeverity {
  LOW = 'low',           // 轻微错误，可以自动恢复
  MEDIUM = 'medium',     // 中等错误，需要用户干预
  HIGH = 'high',         // 严重错误，需要立即处理
  CRITICAL = 'critical'  // 致命错误，需要停止操作
}

// 错误恢复策略
export enum RecoveryStrategy {
  RETRY = 'retry',                      // 重试
  RETRY_WITH_BACKOFF = 'retry_backoff',  // 退避重试
  RESTART = 'restart',                  // 重启
  FALLBACK = 'fallback',                // 降级
  SKIP = 'skip',                        // 跳过
  MANUAL_INTERVENTION = 'manual',       // 手动干预
  IGNORE = 'ignore'                     // 忽略
}

// 错误恢复建议
export interface RecoverySuggestion {
  strategy: RecoveryStrategy
  description: string
  actionRequired: boolean
  params?: Record<string, any>
}

// 完整的错误信息接口
export interface DetailedError {
  category: ErrorCategory
  subType?: string
  code?: string
  message: string
  details?: string
  severity: ErrorSeverity
  timestamp: number
  retryable: boolean
  suggestions: RecoverySuggestion[]
  metadata?: Record<string, any>
}

// ========== 错误分类器 ==========

export class ErrorClassifier {
  /**
   * 根据错误消息和代码分类错误
   */
  static classify(
    error: Error | string | any,
    context?: Record<string, any>
  ): DetailedError {
    const errorMessage = typeof error === 'string' 
      ? error 
      : error?.message || String(error)
    
    const errorCode = error?.code || error?.status
    const statusCode = error?.statusCode || error?.status
    
    return this.classifyByMessage(errorMessage, errorCode || statusCode, context)
  }

  /**
   * 根据错误消息分类
   */
  private static classifyByMessage(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    const lowerMessage = message.toLowerCase()
    
    // 网络错误
    if (this.isNetworkError(lowerMessage, code)) {
      return this.createNetworkError(lowerMessage, code, context)
    }
    
    // 认证错误
    if (this.isAuthenticationError(lowerMessage, code)) {
      return this.createAuthenticationError(lowerMessage, code, context)
    }
    
    // 授权错误
    if (this.isAuthorizationError(lowerMessage, code)) {
      return this.createAuthorizationError(lowerMessage, code, context)
    }
    
    // 文件系统错误
    if (this.isFileSystemError(lowerMessage)) {
      return this.createFileSystemError(lowerMessage, context)
    }
    
    // 服务器错误
    if (this.isServerError(lowerMessage, code)) {
      return this.createServerError(lowerMessage, code, context)
    }
    
    // 客户端错误
    if (this.isClientError(lowerMessage, code)) {
      return this.createClientError(lowerMessage, code, context)
    }
    
    // 超时错误
    if (this.isTimeoutError(lowerMessage)) {
      return this.createTimeoutError(lowerMessage, context)
    }
    
    // 验证错误
    if (this.isValidationError(lowerMessage)) {
      return this.createValidationError(lowerMessage, context)
    }
    
    // 未知错误
    return this.createUnknownError(message, code, context)
  }

  // ========== 错误类型判断 ==========

  private static isNetworkError(message: string, code?: number | string): boolean {
    const networkKeywords = [
      'network', 'connection', 'dns', 'proxy', 'socket',
      'econnrefused', 'enotfound', 'etimedout', 'econnreset',
      'enetworkunreachable', 'ehostunreachable', 'eai_again'
    ]
    
    if (networkKeywords.some(keyword => message.includes(keyword))) {
      return true
    }
    
    // 检查 HTTP 状态码
    if (typeof code === 'number') {
      return code >= 500 && code <= 599
    }
    
    return false
  }

  private static isAuthenticationError(message: string, code?: number | string): boolean {
    const authKeywords = [
      'unauthorized', 'authentication', 'login', 'credential',
      'token', 'session', 'cookie', 'sessdata'
    ]
    
    if (authKeywords.some(keyword => message.includes(keyword))) {
      return true
    }
    
    if (typeof code === 'number') {
      return code === 401
    }
    
    return false
  }

  private static isAuthorizationError(message: string, code?: number | string): boolean {
    const authzKeywords = [
      'forbidden', 'permission', 'authorization', 'access denied',
      'rate limit', 'throttled', 'region', 'vip'
    ]
    
    if (authzKeywords.some(keyword => message.includes(keyword))) {
      return true
    }
    
    if (typeof code === 'number') {
      return code === 403 || code === 429
    }
    
    return false
  }

  private static isFileSystemError(message: string): boolean {
    const fsKeywords = [
      'disk full', 'no space', 'permission denied', 'access denied',
      'file not found', 'directory not found', 'path too long',
      'invalid path', 'file locked', 'quota exceeded'
    ]
    
    return fsKeywords.some(keyword => message.includes(keyword))
  }

  private static isServerError(message: string, code?: number | string): boolean {
    const serverKeywords = [
      'internal server error', 'service unavailable', 'bad gateway',
      'gateway timeout', 'maintenance', 'overloaded', '502', '503', '504'
    ]
    
    if (serverKeywords.some(keyword => message.includes(keyword))) {
      return true
    }
    
    if (typeof code === 'number') {
      return code >= 500 && code <= 599
    }
    
    return false
  }

  private static isClientError(message: string, code?: number | string): boolean {
    const clientKeywords = [
      'bad request', 'invalid request', 'missing parameter',
      'invalid parameter', 'unsupported', 'payload too large'
    ]
    
    if (clientKeywords.some(keyword => message.includes(keyword))) {
      return true
    }
    
    if (typeof code === 'number') {
      return code >= 400 && code < 500 && code !== 401 && code !== 403
    }
    
    return false
  }

  private static isTimeoutError(message: string): boolean {
    const timeoutKeywords = [
      'timeout', 'timed out', 'etimedout'
    ]
    
    return timeoutKeywords.some(keyword => message.includes(keyword))
  }

  private static isValidationError(message: string): boolean {
    const validationKeywords = [
      'invalid url', 'invalid media', 'invalid quality', 'invalid format',
      'missing required', 'constraint violation', 'validation'
    ]
    
    return validationKeywords.some(keyword => message.includes(keyword))
  }

  // ========== 错误创建方法 ==========

  private static createNetworkError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    let severity: ErrorSeverity = ErrorSeverity.MEDIUM
    
    // 确定子类型
    if (message.includes('connection') && message.includes('refused')) {
      subType = NetworkErrorType.CONNECTION_REFUSED
    } else if (message.includes('dns')) {
      subType = NetworkErrorType.DNS_RESOLUTION_FAILED
    } else if (message.includes('ssl') || message.includes('tls')) {
      subType = NetworkErrorType.SSL_ERROR
    } else if (message.includes('proxy')) {
      subType = NetworkErrorType.PROXY_ERROR
    } else if (message.includes('reset')) {
      subType = NetworkErrorType.CONNECTION_RESET
    }
    
    return {
      category: ErrorCategory.NETWORK,
      subType,
      code: String(code),
      message,
      severity,
      timestamp: Date.now(),
      retryable: true,
      suggestions: [
        {
          strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
          description: '网络连接失败，建议稍后重试',
          actionRequired: false,
          params: { maxRetries: 5, backoffMultiplier: 2 }
        },
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '检查网络连接和代理设置',
          actionRequired: true
        }
      ],
      metadata: context
    }
  }

  private static createAuthenticationError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('expired') || message.includes('timeout')) {
      subType = AuthenticationErrorType.TOKEN_EXPIRED
    } else if (message.includes('invalid')) {
      subType = AuthenticationErrorType.TOKEN_INVALID
    } else if (message.includes('credential')) {
      subType = AuthenticationErrorType.INVALID_CREDENTIALS
    } else if (message.includes('banned')) {
      subType = AuthenticationErrorType.ACCOUNT_BANNED
    }
    
    return {
      category: ErrorCategory.AUTHENTICATION,
      subType,
      code: String(code),
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '需要重新登录或刷新认证信息',
          actionRequired: true
        },
        {
          strategy: RecoveryStrategy.RESTART,
          description: '重新启动下载任务',
          actionRequired: true
        }
      ],
      metadata: context
    }
  }

  private static createAuthorizationError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('rate limit') || message.includes('throttled')) {
      subType = AuthorizationErrorType.RATE_LIMIT_EXCEEDED
    } else if (message.includes('permission')) {
      subType = AuthorizationErrorType.INSUFFICIENT_PERMISSIONS
    } else if (message.includes('region')) {
      subType = AuthorizationErrorType.REGION_RESTRICTED
    } else if (message.includes('vip')) {
      subType = AuthorizationErrorType.VIP_REQUIRED
    }
    
    return {
      category: ErrorCategory.AUTHORIZATION,
      subType,
      code: String(code),
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '权限不足或访问受限',
          actionRequired: true
        },
        {
          strategy: RecoveryStrategy.SKIP,
          description: '跳过当前资源',
          actionRequired: false
        }
      ],
      metadata: context
    }
  }

  private static createFileSystemError(
    message: string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('disk full') || message.includes('no space')) {
      subType = FileSystemErrorType.DISK_FULL
    } else if (message.includes('permission')) {
      subType = FileSystemErrorType.PERMISSION_DENIED
    } else if (message.includes('not found')) {
      subType = FileSystemErrorType.FILE_NOT_FOUND
    } else if (message.includes('locked')) {
      subType = FileSystemErrorType.FILE_LOCKED
    } else if (message.includes('quota')) {
      subType = FileSystemErrorType.QUOTA_EXCEEDED
    }
    
    return {
      category: ErrorCategory.FILE_SYSTEM,
      subType,
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '检查磁盘空间和文件权限',
          actionRequired: true
        },
        {
          strategy: RecoveryStrategy.FALLBACK,
          description: '更改下载路径',
          actionRequired: true
        }
      ],
      metadata: context
    }
  }

  private static createServerError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('502') || message.includes('bad gateway')) {
      subType = ServerErrorType.BAD_GATEWAY
    } else if (message.includes('503') || message.includes('service unavailable')) {
      subType = ServerErrorType.SERVICE_UNAVAILABLE
    } else if (message.includes('504') || message.includes('gateway timeout')) {
      subType = ServerErrorType.GATEWAY_TIMEOUT
    } else if (message.includes('maintenance')) {
      subType = ServerErrorType.MAINTENANCE_MODE
    } else if (message.includes('overload')) {
      subType = ServerErrorType.OVERLOADED
    }
    
    return {
      category: ErrorCategory.SERVER,
      subType,
      code: String(code),
      message,
      severity: ErrorSeverity.MEDIUM,
      timestamp: Date.now(),
      retryable: true,
      suggestions: [
        {
          strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
          description: '服务器错误，建议稍后重试',
          actionRequired: false,
          params: { maxRetries: 3, backoffMultiplier: 2 }
        },
        {
          strategy: RecoveryStrategy.FALLBACK,
          description: '降低下载质量',
          actionRequired: false
        }
      ],
      metadata: context
    }
  }

  private static createClientError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('parameter')) {
      subType = ClientErrorType.INVALID_PARAMETER
    } else if (message.includes('unsupported')) {
      subType = ClientErrorType.UNSUPPORTED_MEDIA_TYPE
    } else if (message.includes('payload too large')) {
      subType = ClientErrorType.PAYLOAD_TOO_LARGE
    }
    
    return {
      category: ErrorCategory.CLIENT,
      subType,
      code: String(code),
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '请求参数错误，需要修正',
          actionRequired: true
        },
        {
          strategy: RecoveryStrategy.SKIP,
          description: '跳过当前任务',
          actionRequired: false
        }
      ],
      metadata: context
    }
  }

  private static createTimeoutError(
    message: string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('connection')) {
      subType = TimeoutErrorType.CONNECTION_TIMEOUT
    } else if (message.includes('read')) {
      subType = TimeoutErrorType.READ_TIMEOUT
    } else if (message.includes('write')) {
      subType = TimeoutErrorType.WRITE_TIMEOUT
    }
    
    return {
      category: ErrorCategory.TIMEOUT,
      subType,
      message,
      severity: ErrorSeverity.MEDIUM,
      timestamp: Date.now(),
      retryable: true,
      suggestions: [
        {
          strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
          description: '请求超时，建议增加超时时间后重试',
          actionRequired: false,
          params: { maxRetries: 3, backoffMultiplier: 2 }
        }
      ],
      metadata: context
    }
  }

  private static createValidationError(
    message: string,
    context?: Record<string, any>
  ): DetailedError {
    let subType: string | undefined
    
    if (message.includes('url')) {
      subType = ValidationErrorType.INVALID_URL
    } else if (message.includes('media') || message.includes('bvid')) {
      subType = ValidationErrorType.INVALID_MEDIA_ID
    } else if (message.includes('quality')) {
      subType = ValidationErrorType.INVALID_QUALITY
    } else if (message.includes('format')) {
      subType = ValidationErrorType.INVALID_FORMAT
    }
    
    return {
      category: ErrorCategory.VALIDATION,
      subType,
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '输入数据验证失败，请检查输入',
          actionRequired: true
        },
        {
          strategy: RecoveryStrategy.SKIP,
          description: '跳过当前任务',
          actionRequired: false
        }
      ],
      metadata: context
    }
  }

  private static createUnknownError(
    message: string,
    code?: number | string,
    context?: Record<string, any>
  ): DetailedError {
    return {
      category: ErrorCategory.UNKNOWN,
      code: String(code),
      message,
      severity: ErrorSeverity.MEDIUM,
      timestamp: Date.now(),
      retryable: false,
      suggestions: [
        {
          strategy: RecoveryStrategy.MANUAL_INTERVENTION,
          description: '未知错误，请检查日志并联系支持',
          actionRequired: true
        }
      ],
      metadata: context
    }
  }
}

// ========== 重试管理器 ==========

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
  retryableCategories: ErrorCategory[]
  retryableSubTypes: string[]
}

export class RetryManager {
  private static defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableCategories: [
      ErrorCategory.NETWORK,
      ErrorCategory.TIMEOUT,
      ErrorCategory.SERVER
    ],
    retryableSubTypes: []
  }

  /**
   * 判断错误是否可重试
   */
  static isRetryable(
    error: DetailedError,
    retryCount: number,
    config: Partial<RetryConfig> = {}
  ): boolean {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    // 检查重试次数
    if (retryCount >= finalConfig.maxRetries) {
      return false
    }
    
    // 检查错误是否标记为可重试
    if (!error.retryable) {
      return false
    }
    
    // 检查错误分类是否在可重试列表中
    if (finalConfig.retryableCategories.length > 0 &&
        !finalConfig.retryableCategories.includes(error.category)) {
      return false
    }
    
    // 检查错误子类型是否在可重试列表中
    if (finalConfig.retryableSubTypes.length > 0 && error.subType) {
      if (!finalConfig.retryableSubTypes.includes(error.subType)) {
        return false
      }
    }
    
    return true
  }

  /**
   * 计算重试延迟
   */
  static calculateDelay(
    retryCount: number,
    config: Partial<RetryConfig> = {}
  ): number {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    // 计算指数退避延迟
    const delay = Math.min(
      finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, retryCount),
      finalConfig.maxDelay
    )
    
    // 添加抖动
    if (finalConfig.jitter) {
      const jitter = delay * 0.1 * Math.random()
      return delay + jitter
    }
    
    return delay
  }

  /**
   * 执行带重试的异步操作
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    let retryCount = 0
    const finalConfig = { ...this.defaultConfig, ...config }
    
    while (true) {
      try {
        return await fn()
      } catch (error) {
        const classifiedError = ErrorClassifier.classify(error)
        
        if (!this.isRetryable(classifiedError, retryCount, finalConfig)) {
          throw error
        }
        
        const delay = this.calculateDelay(retryCount, finalConfig)
        console.log(`[RetryManager] Retry ${retryCount + 1}/${finalConfig.maxRetries} after ${delay}ms, error:`, classifiedError.message)
        
        await this.sleep(delay)
        retryCount++
      }
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ========== 错误统计器 ==========

export interface ErrorStats {
  total: number
  byCategory: Record<ErrorCategory, number>
  bySubType: Record<string, number>
  bySeverity: Record<ErrorSeverity, number>
  retryableCount: number
  nonRetryableCount: number
  recentErrors: DetailedError[]
}

export class ErrorStatsCollector {
  private static errors: DetailedError[] = []
  private static maxRecentErrors = 100

  /**
   * 记录错误
   */
  static record(error: DetailedError): void {
    this.errors.push(error)
    
    // 限制存储的错误数量
    if (this.errors.length > this.maxRecentErrors) {
      this.errors.shift()
    }
  }

  /**
   * 获取错误统计
   */
  static getStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySubType: {} as Record<string, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      retryableCount: 0,
      nonRetryableCount: 0,
      recentErrors: this.errors.slice(-20) // 最近20个错误
    }

    // 初始化分类计数
    Object.values(ErrorCategory).forEach(category => {
      stats.byCategory[category] = 0
    })
    
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0
    })

    // 统计错误
    this.errors.forEach(error => {
      stats.byCategory[error.category]++
      
      if (error.subType) {
        stats.bySubType[error.subType] = (stats.bySubType[error.subType] || 0) + 1
      }
      
      stats.bySeverity[error.severity]++
      
      if (error.retryable) {
        stats.retryableCount++
      } else {
        stats.nonRetryableCount++
      }
    })

    return stats
  }

  /**
   * 清除错误记录
   */
  static clear(): void {
    this.errors = []
  }

  /**
   * 获取最近的错误
   */
  static getRecentErrors(count: number = 20): DetailedError[] {
    return this.errors.slice(-count)
  }
}
