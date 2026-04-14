"""
异常和错误类型定义

提供细粒度的错误分类系统，支持错误类型、严重程度和恢复建议。
"""
import enum
from typing import Optional, Dict, Any
from dataclasses import dataclass


class ErrorType(str, enum.Enum):
    """错误类型枚举"""
    # 网络相关错误
    NETWORK_CONNECTION = "network_connection"  # 连接失败
    NETWORK_TIMEOUT = "network_timeout"  # 超时
    NETWORK_DNS = "network_dns"  # DNS解析失败
    NETWORK_RATE_LIMIT = "network_rate_limit"  # 请求频率限制
    NETWORK_PROXY = "network_proxy"  # 代理错误

    # API相关错误
    API_AUTH_FAILED = "api_auth_failed"  # 认证失败
    API_BANNED = "api_banned"  # API被封禁
    API_NOT_FOUND = "api_not_found"  # 资源不存在
    API_INVALID_RESPONSE = "api_invalid_response"  # API响应无效
    API_RATE_LIMIT = "api_rate_limit"  # API频率限制
    API_COOKIE_EXPIRED = "api_cookie_expired"  # Cookie过期

    # 文件系统错误
    FS_NO_SPACE = "fs_no_space"  # 磁盘空间不足
    FS_PERMISSION_DENIED = "fs_permission_denied"  # 权限拒绝
    FS_NOT_FOUND = "fs_not_found"  # 文件不存在
    FS_WRITE_FAILED = "fs_write_failed"  # 写入失败
    FS_READ_FAILED = "fs_read_failed"  # 读取失败
    FS_DELETE_FAILED = "fs_delete_failed"  # 删除失败

    # 工具相关错误
    TOOL_FFMPEG = "tool_ffmpeg"  # FFmpeg工具错误
    TOOL_ARIA2C = "tool_aria2c"  # Aria2c工具错误
    TOOL_YT_DLP = "tool_yt_dlp"  # yt-dlp工具错误
    TOOL_NOT_FOUND = "tool_not_found"  # 工具未找到
    TOOL_EXECUTION_FAILED = "tool_execution_failed"  # 工具执行失败

    # 数据相关错误
    DATA_INVALID = "data_invalid"  # 数据无效
    DATA_MISSING = "data_missing"  # 数据缺失
    DATA_PARSE_FAILED = "data_parse_failed"  # 数据解析失败
    DATA_VALIDATION = "data_validation"  # 数据验证失败

    # 业务逻辑错误
    BIZ_VIDEO_DELETED = "biz_video_deleted"  # 视频已删除
    BIZ_VIDEO_PRIVATE = "biz_video_private"  # 视频为私密
    BIZ_REGION_RESTRICTED = "biz_region_restricted"  # 地区限制
    BIZ_COPYRIGHT_RESTRICTED = "biz_copyright_restricted"  # 版权限制
    BIZ_NOT_AVAILABLE = "biz_not_available"  # 暂不可用

    # 资源相关错误
    RESOURCE_TIMEOUT = "resource_timeout"  # 资源获取超时
    RESOURCE_BUSY = "resource_busy"  # 资源忙碌
    RESOURCE_LIMIT_EXCEEDED = "resource_limit_exceeded"  # 资源限制超限

    # 其他错误
    UNKNOWN = "unknown"  # 未知错误
    USER_CANCELLED = "user_cancelled"  # 用户取消


class ErrorSeverity(str, enum.Enum):
    """错误严重程度"""
    CRITICAL = "critical"  # 严重错误，需要立即处理
    HIGH = "high"  # 高优先级错误
    MEDIUM = "medium"  # 中等优先级错误
    LOW = "low"  # 低优先级错误
    INFO = "info"  # 信息性错误


@dataclass
class ErrorDetail:
    """错误详情数据类"""
    error_type: ErrorType
    error_code: str
    message: str
    severity: ErrorSeverity
    recoverable: bool  # 是否可恢复
    suggestion: Optional[str] = None  # 解决建议
    details: Optional[Dict[str, Any]] = None  # 额外详情
    stack_trace: Optional[str] = None  # 堆栈跟踪

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "error_type": self.error_type.value,
            "error_code": self.error_code,
            "message": self.message,
            "severity": self.severity.value,
            "recoverable": self.recoverable,
            "suggestion": self.suggestion,
            "details": self.details,
            "stack_trace": self.stack_trace
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ErrorDetail':
        """从字典创建"""
        return cls(
            error_type=ErrorType(data.get("error_type", ErrorType.UNKNOWN)),
            error_code=data.get("error_code", ""),
            message=data.get("message", ""),
            severity=ErrorSeverity(data.get("severity", ErrorSeverity.MEDIUM)),
            recoverable=data.get("recoverable", True),
            suggestion=data.get("suggestion"),
            details=data.get("details"),
            stack_trace=data.get("stack_trace")
        )


class PiliNoteError(Exception):
    """PiliNote基础异常类"""

    def __init__(
        self,
        error_type: ErrorType,
        message: str,
        error_code: Optional[str] = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        recoverable: bool = True,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_type = error_type
        self.error_code = error_code or self._generate_error_code(error_type)
        self.message = message
        self.severity = severity
        self.recoverable = recoverable
        self.suggestion = suggestion
        self.details = details or {}
        super().__init__(self.message)

    def _generate_error_code(self, error_type: ErrorType) -> str:
        """生成错误码"""
        # 格式: PNL_<类型>_<三位数字>
        # 获取错误类型的前缀（NETWORK, API, FS等）
        error_value = error_type.value
        # 处理不同的错误类型
        if error_value.startswith('network'):
            prefix = 'NET'
        elif error_value.startswith('api'):
            prefix = 'API'
        elif error_value.startswith('fs'):
            prefix = 'FS'
        elif error_value.startswith('tool'):
            prefix = 'TOOL'
        elif error_value.startswith('biz'):
            prefix = 'BIZ'
        elif error_value.startswith('data'):
            prefix = 'DATA'
        elif error_value.startswith('resource'):
            prefix = 'RES'
        else:
            prefix = 'UNK'
        return f"PNL_{prefix}_001"

    def to_error_detail(self, include_stack: bool = False) -> ErrorDetail:
        """转换为错误详情"""
        import traceback
        stack_trace = traceback.format_exc() if include_stack else None
        return ErrorDetail(
            error_type=self.error_type,
            error_code=self.error_code,
            message=self.message,
            severity=self.severity,
            recoverable=self.recoverable,
            suggestion=self.suggestion,
            details=self.details,
            stack_trace=stack_trace
        )


# ========== 网络错误 ==========

class NetworkError(PiliNoteError):
    """网络错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.NETWORK_CONNECTION, message, **kwargs)


class NetworkTimeoutError(PiliNoteError):
    """网络超时错误"""

    def __init__(self, message: str = "网络连接超时", **kwargs):
        kwargs.setdefault('error_code', 'PNL_NET_TIMEOUT_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请检查网络连接或稍后重试')
        # 不继承NetworkError，直接继承PiliNoteError避免参数冲突
        super().__init__(ErrorType.NETWORK_TIMEOUT, message, **kwargs)


class NetworkRateLimitError(PiliNoteError):
    """网络频率限制错误"""

    def __init__(self, message: str = "请求频率过高，请稍后再试", **kwargs):
        kwargs.setdefault('error_code', 'PNL_NET_RATE_001')
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请稍后再试或降低请求频率')
        super().__init__(ErrorType.NETWORK_RATE_LIMIT, message, **kwargs)


# ========== API错误 ==========

class APIError(PiliNoteError):
    """API错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.API_INVALID_RESPONSE, message, **kwargs)


class APIAuthError(PiliNoteError):
    """API认证错误"""

    def __init__(self, message: str = "认证失败，请检查Cookie", **kwargs):
        kwargs.setdefault('error_code', 'PNL_API_AUTH_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请更新SESSDATA Cookie')
        super().__init__(ErrorType.API_AUTH_FAILED, message, **kwargs)


class APINotFoundError(PiliNoteError):
    """API资源不存在错误"""

    def __init__(self, message: str = "资源不存在", **kwargs):
        kwargs.setdefault('error_code', 'PNL_API_NOTFOUND_001')
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        kwargs.setdefault('recoverable', False)
        kwargs.setdefault('suggestion', '请检查资源ID是否正确或资源是否已被删除')
        super().__init__(ErrorType.API_NOT_FOUND, message, **kwargs)


class APIRateLimitError(PiliNoteError):
    """API频率限制错误"""

    def __init__(self, message: str = "API请求频率限制", **kwargs):
        kwargs.setdefault('error_code', 'PNL_API_RATE_001')
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请稍后再试')
        super().__init__(ErrorType.API_RATE_LIMIT, message, **kwargs)


class APICookieExpiredError(PiliNoteError):
    """API Cookie过期错误"""

    def __init__(self, message: str = "Cookie已过期", **kwargs):
        kwargs.setdefault('error_code', 'PNL_API_COOKIE_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请重新登录获取新的Cookie')
        super().__init__(ErrorType.API_COOKIE_EXPIRED, message, **kwargs)


class APIBannedError(PiliNoteError):
    """API被封禁错误"""

    def __init__(self, message: str = "API请求被限制", **kwargs):
        kwargs.setdefault('error_code', 'PNL_API_BANNED_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请稍后再试或更换IP地址')
        super().__init__(ErrorType.API_BANNED, message, **kwargs)


# ========== 文件系统错误 ==========

class FileSystemError(PiliNoteError):
    """文件系统错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.FS_WRITE_FAILED, message, **kwargs)


class FileSystemNoSpaceError(PiliNoteError):
    """磁盘空间不足错误"""

    def __init__(self, message: str = "磁盘空间不足", **kwargs):
        kwargs.setdefault('error_code', 'PNL_FS_SPACE_001')
        kwargs.setdefault('severity', ErrorSeverity.CRITICAL)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请清理磁盘空间或更改下载路径')
        super().__init__(ErrorType.FS_NO_SPACE, message, **kwargs)


class FileSystemPermissionError(PiliNoteError):
    """文件权限错误"""

    def __init__(self, message: str = "文件权限不足", **kwargs):
        kwargs.setdefault('error_code', 'PNL_FS_PERM_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请检查文件权限或更换下载路径')
        super().__init__(ErrorType.FS_PERMISSION_DENIED, message, **kwargs)


# ========== 工具错误 ==========

class ToolError(PiliNoteError):
    """工具错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.TOOL_EXECUTION_FAILED, message, **kwargs)


class ToolNotFoundError(PiliNoteError):
    """工具未找到错误"""

    def __init__(self, tool_name: str, **kwargs):
        message = f"工具 '{tool_name}' 未找到"
        kwargs.setdefault('error_code', 'PNL_TOOL_NOTFOUND_001')
        kwargs.setdefault('severity', ErrorSeverity.CRITICAL)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', f'请安装 {tool_name} 或在设置中配置自定义路径')
        kwargs.setdefault('details', {'tool_name': tool_name})
        super().__init__(ErrorType.TOOL_NOT_FOUND, message, **kwargs)


class ToolExecutionError(PiliNoteError):
    """工具执行错误"""

    def __init__(self, tool_name: str, error_message: str, **kwargs):
        message = f"工具 '{tool_name}' 执行失败: {error_message}"
        kwargs.setdefault('error_code', 'PNL_TOOL_EXEC_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', f'请检查 {tool_name} 配置或尝试使用其他下载方式')
        kwargs.setdefault('details', {'tool_name': tool_name, 'error': error_message})
        super().__init__(ErrorType.TOOL_EXECUTION_FAILED, message, **kwargs)


# ========== 业务逻辑错误 ==========

class BusinessError(PiliNoteError):
    """业务逻辑错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.BIZ_NOT_AVAILABLE, message, **kwargs)


class VideoDeletedError(PiliNoteError):
    """视频已删除错误"""

    def __init__(self, message: str = "视频已被删除", **kwargs):
        kwargs.setdefault('error_code', 'PNL_BIZ_DELETED_001')
        kwargs.setdefault('severity', ErrorSeverity.LOW)
        kwargs.setdefault('recoverable', False)
        kwargs.setdefault('suggestion', '该视频已被删除，无法下载')
        super().__init__(ErrorType.BIZ_VIDEO_DELETED, message, **kwargs)


class VideoPrivateError(PiliNoteError):
    """视频为私密错误"""

    def __init__(self, message: str = "视频为私密视频", **kwargs):
        kwargs.setdefault('error_code', 'PNL_BIZ_PRIVATE_001')
        kwargs.setdefault('severity', ErrorSeverity.LOW)
        kwargs.setdefault('recoverable', False)
        kwargs.setdefault('suggestion', '该视频为私密视频，无法下载')
        super().__init__(ErrorType.BIZ_VIDEO_PRIVATE, message, **kwargs)


class RegionRestrictedError(PiliNoteError):
    """地区限制错误"""

    def __init__(self, message: str = "该视频在您所在的地区无法访问", **kwargs):
        kwargs.setdefault('error_code', 'PNL_BIZ_REGION_001')
        kwargs.setdefault('severity', ErrorSeverity.LOW)
        kwargs.setdefault('recoverable', False)
        kwargs.setdefault('suggestion', '该视频有地区限制，无法下载')
        super().__init__(ErrorType.BIZ_REGION_RESTRICTED, message, **kwargs)


# ========== 资源错误 ==========

class ResourceError(PiliNoteError):
    """资源错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.RESOURCE_TIMEOUT, message, **kwargs)


class ResourceTimeoutError(PiliNoteError):
    """资源获取超时错误"""

    def __init__(self, message: str = "资源获取超时", **kwargs):
        kwargs.setdefault('error_code', 'PNL_RES_TIMEOUT_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请稍后再试')
        super().__init__(ErrorType.RESOURCE_TIMEOUT, message, **kwargs)


class ResourceLimitExceededError(PiliNoteError):
    """资源限制超限错误"""

    def __init__(self, message: str = "资源限制已超限", **kwargs):
        kwargs.setdefault('error_code', 'PNL_RES_LIMIT_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请等待其他任务完成后再试')
        super().__init__(ErrorType.RESOURCE_LIMIT_EXCEEDED, message, **kwargs)


# ========== 数据错误 ==========

class DataError(PiliNoteError):
    """数据错误基类"""

    def __init__(self, message: str, **kwargs):
        super().__init__(ErrorType.DATA_INVALID, message, **kwargs)


class DataValidationError(PiliNoteError):
    """数据验证错误"""

    def __init__(self, message: str = "数据验证失败", **kwargs):
        kwargs.setdefault('error_code', 'PNL_DATA_VALID_001')
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        kwargs.setdefault('recoverable', False)
        kwargs.setdefault('suggestion', '请检查输入数据格式')
        super().__init__(ErrorType.DATA_VALIDATION, message, **kwargs)


class DataParseError(PiliNoteError):
    """数据解析错误"""

    def __init__(self, message: str = "数据解析失败", **kwargs):
        kwargs.setdefault('error_code', 'PNL_DATA_PARSE_001')
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        kwargs.setdefault('recoverable', True)
        kwargs.setdefault('suggestion', '请检查数据格式或稍后再试')
        super().__init__(ErrorType.DATA_PARSE_FAILED, message, **kwargs)