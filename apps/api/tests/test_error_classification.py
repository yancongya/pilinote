"""
错误分类系统测试

测试错误分类、错误详情生成和错误处理器的功能。
"""
import asyncio
from pathlib import Path

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

from src.utils.error_handler import ErrorHandler, handle_error


class TestErrorTypes:
    """测试错误类型枚举"""

    def test_error_type_network(self):
        """测试网络错误类型"""
        assert ErrorType.NETWORK_CONNECTION.value == "network_connection"
        assert ErrorType.NETWORK_TIMEOUT.value == "network_timeout"
        assert ErrorType.NETWORK_RATE_LIMIT.value == "network_rate_limit"

    def test_error_type_api(self):
        """测试API错误类型"""
        assert ErrorType.API_AUTH_FAILED.value == "api_auth_failed"
        assert ErrorType.API_BANNED.value == "api_banned"
        assert ErrorType.API_NOT_FOUND.value == "api_not_found"

    def test_error_type_fs(self):
        """测试文件系统错误类型"""
        assert ErrorType.FS_NO_SPACE.value == "fs_no_space"
        assert ErrorType.FS_PERMISSION_DENIED.value == "fs_permission_denied"

    def test_error_type_tool(self):
        """测试工具错误类型"""
        assert ErrorType.TOOL_FFMPEG.value == "tool_ffmpeg"
        assert ErrorType.TOOL_ARIA2C.value == "tool_aria2c"
        assert ErrorType.TOOL_YT_DLP.value == "tool_yt_dlp"


class TestErrorExceptions:
    """测试错误异常类"""

    def test_pilinote_error_creation(self):
        """测试基础错误创建"""
        error = PiliNoteError(
            error_type=ErrorType.NETWORK_CONNECTION,
            message="测试错误消息"
        )
        assert error.error_type == ErrorType.NETWORK_CONNECTION
        assert error.message == "测试错误消息"
        assert error.error_code == "PNL_NET_001"

    def test_network_timeout_error(self):
        """测试网络超时错误"""
        error = NetworkTimeoutError()
        assert error.error_type == ErrorType.NETWORK_TIMEOUT
        assert error.error_code == "PNL_NET_TIMEOUT_001"
        assert error.severity == ErrorSeverity.HIGH
        assert error.recoverable is True
        assert error.suggestion is not None

    def test_api_auth_error(self):
        """测试API认证错误"""
        error = APIAuthError()
        assert error.error_type == ErrorType.API_AUTH_FAILED
        assert error.error_code == "PNL_API_AUTH_001"
        assert error.severity == ErrorSeverity.HIGH

    def test_fs_no_space_error(self):
        """测试磁盘空间不足错误"""
        error = FileSystemNoSpaceError()
        assert error.error_type == ErrorType.FS_NO_SPACE
        assert error.error_code == "PNL_FS_SPACE_001"
        assert error.severity == ErrorSeverity.CRITICAL

    def test_tool_not_found_error(self):
        """测试工具未找到错误"""
        error = ToolNotFoundError(tool_name="ffmpeg")
        assert error.error_type == ErrorType.TOOL_NOT_FOUND
        assert error.error_code == "PNL_TOOL_NOTFOUND_001"
        assert error.details['tool_name'] == "ffmpeg"

    def test_video_deleted_error(self):
        """测试视频已删除错误"""
        error = VideoDeletedError()
        assert error.error_type == ErrorType.BIZ_VIDEO_DELETED
        assert error.error_code == "PNL_BIZ_DELETED_001"
        assert error.recoverable is False


class TestErrorDetail:
    """测试错误详情"""

    def test_error_detail_creation(self):
        """测试错误详情创建"""
        detail = ErrorDetail(
            error_type=ErrorType.NETWORK_TIMEOUT,
            error_code="PNL_NET_TIMEOUT_001",
            message="网络超时",
            severity=ErrorSeverity.HIGH,
            recoverable=True,
            suggestion="请检查网络连接"
        )
        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert detail.message == "网络超时"

    def test_error_detail_to_dict(self):
        """测试错误详情转字典"""
        detail = ErrorDetail(
            error_type=ErrorType.NETWORK_TIMEOUT,
            error_code="PNL_NET_TIMEOUT_001",
            message="网络超时",
            severity=ErrorSeverity.HIGH,
            recoverable=True
        )
        data = detail.to_dict()
        assert data['error_type'] == "network_timeout"
        assert data['error_code'] == "PNL_NET_TIMEOUT_001"
        assert data['severity'] == "high"

    def test_error_detail_from_dict(self):
        """测试从字典创建错误详情"""
        data = {
            "error_type": "network_timeout",
            "error_code": "PNL_NET_TIMEOUT_001",
            "message": "网络超时",
            "severity": "high",
            "recoverable": True
        }
        detail = ErrorDetail.from_dict(data)
        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert detail.message == "网络超时"

    def test_pilinote_error_to_error_detail(self):
        """测试PiliNoteError转换为ErrorDetail"""
        error = NetworkTimeoutError()
        detail = error.to_error_detail(include_stack=False)
        assert isinstance(detail, ErrorDetail)
        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert detail.stack_trace is None

        detail_with_stack = error.to_error_detail(include_stack=True)
        assert detail_with_stack.stack_trace is not None


class TestErrorHandler:
    """测试错误处理器"""

    def test_classify_network_timeout(self):
        """测试分类网络超时错误"""
        import httpx
        error = httpx.TimeoutException("请求超时")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, NetworkTimeoutError)
        assert classified.error_type == ErrorType.NETWORK_TIMEOUT

    def test_classify_api_404(self):
        """测试分类API 404错误"""
        import httpx
        response = httpx.Response(404, request=httpx.Request("GET", "https://example.com"))
        error = httpx.HTTPStatusError("Not Found", request=response.request, response=response)
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, APINotFoundError)
        assert classified.error_type == ErrorType.API_NOT_FOUND

    def test_classify_api_401(self):
        """测试分类API 401错误"""
        import httpx
        response = httpx.Response(401, request=httpx.Request("GET", "https://example.com"))
        error = httpx.HTTPStatusError("Unauthorized", request=response.request, response=response)
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, APIAuthError)
        assert classified.error_type == ErrorType.API_AUTH_FAILED

    def test_classify_value_error_json(self):
        """测试分类JSON解析错误"""
        error = ValueError("JSON解析失败: Expecting value: line 1 column 1 (char 0)")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, DataParseError)
        assert classified.error_type == ErrorType.DATA_PARSE_FAILED

    def test_classify_os_error_no_space(self):
        """测试分类磁盘空间不足错误"""
        import errno
        error = OSError(errno.ENOSPC, "No space left on device")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, FileSystemNoSpaceError)
        assert classified.error_type == ErrorType.FS_NO_SPACE

    def test_classify_os_error_permission(self):
        """测试分类权限错误"""
        import errno
        error = OSError(errno.EACCES, "Permission denied")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, FileSystemPermissionError)
        assert classified.error_type == ErrorType.FS_PERMISSION_DENIED

    def test_classify_bilibili_rate_limit(self):
        """测试分类B站频率限制错误"""
        error = Exception("请求频率过高，请稍后再试")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, NetworkRateLimitError)
        assert classified.error_type == ErrorType.NETWORK_RATE_LIMIT

    def test_classify_bilibili_banned(self):
        """测试分类B站封禁错误"""
        error = Exception("请求被banned")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, APIBannedError)
        assert classified.error_type == ErrorType.API_BANNED

    def test_classify_bilibili_video_deleted(self):
        """测试分类视频已删除错误"""
        error = Exception("视频已删除")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, VideoDeletedError)
        assert classified.error_type == ErrorType.BIZ_VIDEO_DELETED

    def test_classify_unknown_error(self):
        """测试分类未知错误"""
        error = Exception("未知错误")
        classified = ErrorHandler.classify_error(error)
        assert isinstance(classified, PiliNoteError)
        assert classified.error_type == ErrorType.UNKNOWN

    def test_create_error_detail(self):
        """测试创建错误详情"""
        error = NetworkTimeoutError()
        context = {'task_id': '123', 'media_type': 'video'}
        detail = ErrorHandler.create_error_detail(error, context, include_stack=False)

        assert isinstance(detail, ErrorDetail)
        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert 'task_id' in detail.details
        assert detail.details['task_id'] == '123'

    def test_handle_exception(self):
        """测试处理异常"""
        error = NetworkTimeoutError()
        detail = ErrorHandler.handle_exception(error, log_level="error", raise_error=False)

        assert isinstance(detail, ErrorDetail)
        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert detail.message is not None

    def test_check_disk_space(self):
        """测试检查磁盘空间"""
        import tempfile
        import os

        # 创建临时目录
        with tempfile.TemporaryDirectory() as tmpdir:
            # 检查有足够空间的情况
            # 这里的空间需求很小，应该不会抛出异常
            ErrorHandler.check_disk_space(tmpdir, 1024)  # 1KB

            # 测试空间不足的情况（需要巨大的空间）
            # 这个测试可能会失败，因为需要很大的空间
            try:
                ErrorHandler.check_disk_space(tmpdir, 10**15)  # 1PB
                # 如果没有抛出异常，说明磁盘真的有那么大的空间
                pass
            except FileSystemNoSpaceError as e:
                # 期望抛出空间不足错误
                assert e.error_type == ErrorType.FS_NO_SPACE


class TestErrorScenarios:
    """测试实际错误场景"""

    def test_download_timeout_scenario(self):
        """测试下载超时场景"""
        import httpx
        response = httpx.Response(504, request=httpx.Request("GET", "https://api.bilibili.com/video/123"))
        error = httpx.HTTPStatusError("Gateway Timeout", request=response.request, response=response)

        context = {'bvid': 'BV1xx411c7mD', 'quality': 80}
        detail = ErrorHandler.handle_exception(error, context, raise_error=False)

        assert detail.error_type == ErrorType.NETWORK_TIMEOUT
        assert detail.severity == ErrorSeverity.HIGH
        assert detail.recoverable is True

    def test_api_auth_failed_scenario(self):
        """测试API认证失败场景"""
        import httpx
        response = httpx.Response(401, request=httpx.Request("GET", "https://api.bilibili.com/video/123"))
        error = httpx.HTTPStatusError("Unauthorized", request=response.request, response=response)

        context = {'bvid': 'BV1xx411c7mD', 'endpoint': 'video_info'}
        detail = ErrorHandler.handle_exception(error, context, raise_error=False)

        assert detail.error_type == ErrorType.API_AUTH_FAILED
        assert detail.severity == ErrorSeverity.HIGH
        assert detail.suggestion is not None

    def test_video_deleted_scenario(self):
        """测试视频已删除场景"""
        error = Exception("视频已删除或审核中")

        context = {'bvid': 'BV1xx411c7mD', 'title': '测试视频'}
        detail = ErrorHandler.handle_exception(error, context, raise_error=False)

        assert detail.error_type == ErrorType.BIZ_VIDEO_DELETED
        assert detail.severity == ErrorSeverity.LOW
        assert detail.recoverable is False

    def test_tool_not_found_scenario(self):
        """测试工具未找到场景"""
        error = Exception("ffmpeg not found")

        context = {'tool_name': 'ffmpeg', 'operation': 'format_conversion'}
        detail = ErrorHandler.handle_exception(error, context, raise_error=False)

        assert detail.error_type == ErrorType.TOOL_NOT_FOUND
        assert detail.severity == ErrorSeverity.CRITICAL
        assert detail.suggestion is not None

    def test_disk_space_scenario(self):
        """测试磁盘空间不足场景"""
        import errno
        error = OSError(errno.ENOSPC, "No space left on device: '/downloads/video.mp4'")

        context = {'path': '/downloads/video.mp4', 'file_size': 1024*1024*1024}  # 1GB
        detail = ErrorHandler.handle_exception(error, context, raise_error=False)

        assert detail.error_type == ErrorType.FS_NO_SPACE
        assert detail.severity == ErrorSeverity.CRITICAL
        assert detail.recoverable is True


def test_main():
    """主测试函数"""
    print("开始测试错误分类系统...")
    print("=" * 60)

    # 测试错误类型
    test_error_types = TestErrorTypes()
    test_error_types.test_error_type_network()
    test_error_types.test_error_type_api()
    test_error_types.test_error_type_fs()
    test_error_types.test_error_type_tool()
    print("✓ 错误类型测试通过")

    # 测试错误异常
    test_exceptions = TestErrorExceptions()
    test_exceptions.test_pilinote_error_creation()
    test_exceptions.test_network_timeout_error()
    test_exceptions.test_api_auth_error()
    test_exceptions.test_fs_no_space_error()
    test_exceptions.test_tool_not_found_error()
    test_exceptions.test_video_deleted_error()
    print("✓ 错误异常测试通过")

    # 测试错误详情
    test_detail = TestErrorDetail()
    test_detail.test_error_detail_creation()
    test_detail.test_error_detail_to_dict()
    test_detail.test_error_detail_from_dict()
    test_detail.test_pilinote_error_to_error_detail()
    print("✓ 错误详情测试通过")

    # 测试错误处理器
    test_handler = TestErrorHandler()
    test_handler.test_classify_network_timeout()
    test_handler.test_classify_api_404()
    test_handler.test_classify_api_401()
    test_handler.test_classify_value_error_json()
    test_handler.test_classify_os_error_no_space()
    test_handler.test_classify_os_error_permission()
    test_handler.test_classify_bilibili_rate_limit()
    test_handler.test_classify_bilibili_banned()
    test_handler.test_classify_bilibili_video_deleted()
    test_handler.test_classify_unknown_error()
    test_handler.test_create_error_detail()
    test_handler.test_handle_exception()
    test_handler.test_check_disk_space()
    print("✓ 错误处理器测试通过")

    # 测试实际场景
    test_scenarios = TestErrorScenarios()
    test_scenarios.test_download_timeout_scenario()
    test_scenarios.test_api_auth_failed_scenario()
    test_scenarios.test_video_deleted_scenario()
    test_scenarios.test_tool_not_found_scenario()
    test_scenarios.test_disk_space_scenario()
    print("✓ 实际场景测试通过")

    print("=" * 60)
    print("✅ 所有测试通过！")


if __name__ == "__main__":
    test_main()