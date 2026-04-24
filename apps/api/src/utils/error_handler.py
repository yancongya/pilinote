"""
错误处理器 - 统一捕获和分类错误

将普通异常转换为PiliNoteError，并提供错误分类和恢复建议。
"""
import logging
import traceback
import errno
import os
import asyncio
from typing import Optional, Dict, Any, Type
from pathlib import Path

import httpx
from yt_dlp.utils import DownloadError as YtDlpDownloadError

from src.models.exceptions import (
    ErrorType,
    ErrorSeverity,
    ErrorDetail,
    PiliNoteError,
    NetworkError,
    NetworkTimeoutError,
    NetworkRateLimitError,
    APIError,
    APIAuthError,
    APINotFoundError,
    APIRateLimitError,
    APICookieExpiredError,
    APIBannedError,
    FileSystemError,
    FileSystemNoSpaceError,
    FileSystemPermissionError,
    ToolError,
    ToolNotFoundError,
    ToolExecutionError,
    BusinessError,
    VideoDeletedError,
    VideoPrivateError,
    RegionRestrictedError,
    ResourceError,
    ResourceTimeoutError,
    ResourceLimitExceededError,
    DataError,
    DataValidationError,
    DataParseError
)

logger = logging.getLogger(__name__)


class ErrorHandler:
    """错误处理器"""

    # HTTP状态码映射
    HTTP_STATUS_MAP = {
        401: (APIAuthError, "认证失败"),
        403: (APIAuthError, "访问被拒绝"),
        404: (APINotFoundError, "资源不存在"),
        429: (APIRateLimitError, "请求频率过高"),
        412: (APIBannedError, "请求被限制"),
        500: (APIError, "服务器错误"),
        502: (APIError, "网关错误"),
        503: (APIError, "服务不可用"),
        504: (NetworkTimeoutError, "网关超时"),
    }

    # B站API错误消息映射
    BILIBILI_ERROR_MAP = {
        "请求频率过高": NetworkRateLimitError,
        "请求被banned": APIBannedError,
        "账号未登录": APIAuthError,
        "权限不足": APIAuthError,
        "视频不存在": APINotFoundError,
        "视频已删除": VideoDeletedError,
        "视频审核中": VideoDeletedError,
        "视频不可用": BusinessError,
        "地区限制": RegionRestrictedError,
        "版权限制": RegionRestrictedError,
        "SSL": NetworkError,  # SSL相关错误
        "证书": NetworkError, # 证书相关错误
    }

    @classmethod
    def classify_error(cls, error: Exception, context: Optional[Dict[str, Any]] = None) -> PiliNoteError:
        """
        分类错误

        Args:
            error: 原始异常
            context: 上下文信息

        Returns:
            PiliNoteError: 分类后的错误
        """
        context = context or {}
        error_message = str(error)
        error_type_name = type(error).__name__

        logger.debug(f"分类错误: {error_type_name} - {error_message}")

        # 1. 如果已经是PiliNoteError，直接返回
        if isinstance(error, PiliNoteError):
            return error

        # 2. 处理 asyncio.CancelledError
        if isinstance(error, asyncio.CancelledError):
            return PiliNoteError(
                error_type=ErrorType.USER_CANCELLED,
                message="任务已取消",
                severity=ErrorSeverity.INFO,
                recoverable=False
            )

        # 3. 处理网络错误
        if isinstance(error, httpx.TimeoutException):
            return NetworkTimeoutError(
                message=f"网络请求超时: {error_message}",
                details={'original_error': error_message}
            )

        if isinstance(error, httpx.ConnectError):
            return NetworkError(
                message=f"网络连接失败: {error_message}",
                details={'original_error': error_message}
            )

        if isinstance(error, httpx.HTTPStatusError):
            status_code = error.response.status_code
            error_class, default_message = cls.HTTP_STATUS_MAP.get(
                status_code,
                (APIError, f"HTTP错误: {status_code}")
            )
            return error_class(
                message=f"{default_message}: {error_message}",
                details={'status_code': status_code, 'url': str(error.response.url)}
            )

        # 4. 处理文件系统错误
        if isinstance(error, OSError):
            if error.errno == errno.ENOSPC:
                return FileSystemNoSpaceError(
                    message=f"磁盘空间不足: {error_message}",
                    details={'original_error': error_message}
                )
            elif error.errno in (errno.EACCES, errno.EPERM):
                return FileSystemPermissionError(
                    message=f"文件权限不足: {error_message}",
                    details={'original_error': error_message}
                )
            elif error.errno == errno.ENOENT:
                return FileSystemError(
                    message=f"文件不存在: {error_message}",
                    error_type=ErrorType.FS_NOT_FOUND,
                    details={'original_error': error_message}
                )
            elif error.errno == errno.ETIMEDOUT:
                return NetworkTimeoutError(
                    message=f"操作超时: {error_message}",
                    details={'original_error': error_message}
                )

        # 5. 处理 yt-dlp 错误
        if isinstance(error, YtDlpDownloadError):
            return cls._classify_yt_dlp_error(error, error_message)

        # 6. 处理JSON解析错误
        if isinstance(error, (ValueError, TypeError)):
            if 'JSON' in error_type_name or 'json' in error_message.lower():
                return DataParseError(
                    message=f"JSON解析失败: {error_message}",
                    details={'original_error': error_message}
                )

        # 7. 处理ValueError（可能是数据验证错误）
        if isinstance(error, ValueError):
            if any(keyword in error_message.lower() for keyword in ['invalid', '无效', '验证', 'validation']):
                return DataValidationError(
                    message=f"数据验证失败: {error_message}",
                    details={'original_error': error_message}
                )
            if any(keyword in error_message.lower() for keyword in ['parse', '解析', '格式']):
                return DataParseError(
                    message=f"数据解析失败: {error_message}",
                    details={'original_error': error_message}
                )

        # 8. 根据错误消息内容分类
        return cls._classify_by_message(error_message, context)

    @classmethod
    def _classify_yt_dlp_error(cls, error: YtDlpDownloadError, error_message: str) -> PiliNoteError:
        """分类 yt-dlp 错误"""
        error_lower = error_message.lower()

        # 网络错误
        if any(keyword in error_lower for keyword in ['timeout', '超时', 'timed out']):
            return NetworkTimeoutError(
                message=f"下载超时: {error_message}",
                details={'original_error': error_message}
            )

        if any(keyword in error_lower for keyword in ['network', 'network error', 'network is unreachable']):
            return NetworkError(
                message=f"网络错误: {error_message}",
                details={'original_error': error_message}
            )

        # 视频不可用
        if any(keyword in error_lower for keyword in ['not found', '404', 'video not found', '不存在']):
            return APINotFoundError(
                message=f"视频不存在: {error_message}",
                details={'original_error': error_message}
            )

        if any(keyword in error_lower for keyword in ['private', '私密', '会员', 'premium']):
            return VideoPrivateError(
                message=f"视频为私密或会员专属: {error_message}",
                details={'original_error': error_message}
            )

        if any(keyword in error_lower for keyword in ['deleted', '删除', 'removed']):
            return VideoDeletedError(
                message=f"视频已删除: {error_message}",
                details={'original_error': error_message}
            )

        if any(keyword in error_lower for keyword in ['region', 'geo', '地区', 'unavailable in your country']):
            return RegionRestrictedError(
                message=f"地区限制: {error_message}",
                details={'original_error': error_message}
            )

        # 认证错误
        if any(keyword in error_lower for keyword in ['login', 'sign in', '登录', '认证', 'auth']):
            return APIAuthError(
                message=f"需要登录: {error_message}",
                details={'original_error': error_message}
            )

        # 频率限制
        if any(keyword in error_lower for keyword in ['rate limit', 'too many requests', '频率', '429']):
            return APIRateLimitError(
                message=f"请求频率限制: {error_message}",
                details={'original_error': error_message}
            )

        # 工具错误
        if 'ffmpeg' in error_lower:
            return ToolExecutionError(
                tool_name='ffmpeg',
                error_message=error_message,
                details={'original_error': error_message}
            )

        if 'aria2' in error_lower:
            return ToolExecutionError(
                tool_name='aria2c',
                error_message=error_message,
                details={'original_error': error_message}
            )

        # 默认返回下载错误
        return PiliNoteError(
            error_type=ErrorType.TOOL_EXECUTION_FAILED,
            message=f"下载失败: {error_message}",
            severity=ErrorSeverity.HIGH,
            recoverable=True,
            suggestion='请稍后再试或尝试其他下载方式',
            details={'original_error': error_message}
        )

    @classmethod
    def _classify_by_message(cls, message: str, context: Dict[str, Any]) -> PiliNoteError:
        """根据错误消息内容分类"""
        message_lower = message.lower()

        # B站API错误
        for error_keyword, error_class in cls.BILIBILI_ERROR_MAP.items():
            if error_keyword in message:
                return error_class(
                    message=message,
                    details={'original_error': message, 'context': context}
                )

        # 网络错误
        if any(keyword in message_lower for keyword in ['timeout', '超时', 'timed out']):
            return NetworkTimeoutError(
                message=message,
                details={'original_error': message}
            )

        if any(keyword in message_lower for keyword in ['connection', '连接', 'network', '网络']):
            return NetworkError(
                message=message,
                details={'original_error': message}
            )

        # SSL/TLS错误
        if any(keyword in message_lower for keyword in ['ssl', '证书', 'tls', 'https', 'certificate', 'handshake', 'protocol']):
            return NetworkError(
                message=f"SSL连接错误: {message}",
                details={'original_error': message, 'error_type': 'ssl_error'}
            )

        # 文件系统错误
        if any(keyword in message_lower for keyword in ['disk', '磁盘', 'space', '空间', 'no space']):
            return FileSystemNoSpaceError(
                message=message,
                details={'original_error': message}
            )

        if any(keyword in message_lower for keyword in ['permission', '权限', 'access denied']):
            return FileSystemPermissionError(
                message=message,
                details={'original_error': message}
            )

        # 工具错误
        if any(keyword in message_lower for keyword in ['tool', '工具', 'ffmpeg', 'aria2', 'yt-dlp']):
            # 检查是否是工具未找到的情况
            if 'not found' in message_lower or '未找到' in message_lower or '不存在' in message_lower:
                # 尝试提取工具名称
                tool_name = 'unknown'
                for tool in ['ffmpeg', 'aria2', 'aria2c', 'yt-dlp']:
                    if tool in message_lower:
                        tool_name = tool
                        break
                return ToolNotFoundError(tool_name=tool_name)
            else:
                return ToolExecutionError(
                    tool_name='unknown',
                    error_message=message,
                    details={'original_error': message}
                )

        # 默认返回未知错误
        return PiliNoteError(
            error_type=ErrorType.UNKNOWN,
            message=message,
            severity=ErrorSeverity.MEDIUM,
            recoverable=True,
            details={'original_error': message, 'context': context}
        )

    @classmethod
    def create_error_detail(
        cls,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        include_stack: bool = False
    ) -> ErrorDetail:
        """
        创建错误详情

        Args:
            error: 原始异常
            context: 上下文信息
            include_stack: 是否包含堆栈跟踪

        Returns:
            ErrorDetail: 错误详情
        """
        # 分类错误
        pilinote_error = cls.classify_error(error, context)

        # 转换为错误详情
        error_detail = pilinote_error.to_error_detail(include_stack=include_stack)

        # 添加上下文信息
        if context:
            if error_detail.details is None:
                error_detail.details = {}
            error_detail.details.update(context)

        logger.info(f"错误分类: {error_detail.error_code} - {error_detail.message}")

        return error_detail

    @classmethod
    def handle_exception(
        cls,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        log_level: str = "error",
        raise_error: bool = False
    ) -> ErrorDetail:
        """
        处理异常

        Args:
            error: 原始异常
            context: 上下文信息
            log_level: 日志级别 (error/warning/info/debug)
            raise_error: 是否重新抛出异常

        Returns:
            ErrorDetail: 错误详情
        """
        # 创建错误详情
        error_detail = cls.create_error_detail(error, context, include_stack=True)

        # 记录日志
        log_method = getattr(logger, log_level, logger.error)
        log_method(
            f"错误处理: [{error_detail.error_code}] {error_detail.message}",
            extra={
                'error_type': error_detail.error_type,
                'error_code': error_detail.error_code,
                'severity': error_detail.severity,
                'recoverable': error_detail.recoverable,
                'context': context
            }
        )

        # 根据严重程度决定是否记录堆栈
        if error_detail.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]:
            log_method(f"堆栈跟踪:\n{error_detail.stack_trace}")

        # 是否重新抛出异常
        if raise_error:
            raise error

        return error_detail

    @classmethod
    def check_disk_space(cls, path: str, required_bytes: int) -> None:
        """
        检查磁盘空间

        Args:
            path: 路径
            required_bytes: 需要的字节数

        Raises:
            FileSystemNoSpaceError: 磁盘空间不足
        """
        try:
            stat = os.statvfs(path)
            free_space = stat.f_bavail * stat.f_frsize

            if free_space < required_bytes:
                free_mb = free_space / 1024 / 1024
                required_mb = required_bytes / 1024 / 1024
                raise FileSystemNoSpaceError(
                    message=f"磁盘空间不足: 需要 {required_mb:.2f}MB，可用 {free_mb:.2f}MB",
                    details={
                        'path': path,
                        'required_bytes': required_bytes,
                        'free_bytes': free_space,
                        'free_mb': free_mb,
                        'required_mb': required_mb
                    }
                )
        except OSError as e:
            logger.warning(f"无法检查磁盘空间 {path}: {e}")

    @classmethod
    def check_tool_available(cls, tool_name: str) -> None:
        """
        检查工具是否可用

        Args:
            tool_name: 工具名称

        Raises:
            ToolNotFoundError: 工具未找到
        """
        import shutil
        if not shutil.which(tool_name):
            raise ToolNotFoundError(tool_name=tool_name)


def handle_error(
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
    log_level: str = "error",
    raise_error: bool = False
) -> ErrorDetail:
    """
    处理错误的便捷函数

    Args:
        error: 原始异常
        context: 上下文信息
        log_level: 日志级别 (error/warning/info/debug)
        raise_error: 是否重新抛出异常

    Returns:
        ErrorDetail: 错误详情
    """
    return ErrorHandler.handle_exception(error, context, log_level, raise_error)
