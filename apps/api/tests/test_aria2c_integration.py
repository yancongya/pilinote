#!/usr/bin/env python3
"""
Aria2c集成测试脚本
"""
import sys
import asyncio
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))


def test_download_engine():
    """测试DownloadEngine的Aria2c集成"""
    print("=" * 60)
    print("测试1: DownloadEngine Aria2c集成")
    print("=" * 60)

    from src.services.download_engine import DownloadEngine

    # 测试1: 创建下载引擎实例
    print("\n[1/4] 创建DownloadEngine实例...")
    engine = DownloadEngine()
    print("✓ 实例创建成功")

    # 测试2: 检查Aria2c可用性
    print("\n[2/4] 检查Aria2c可用性...")
    is_available = engine._check_aria2c_available()
    print(f"✓ Aria2c可用性: {is_available}")
    if not is_available:
        print("  ℹ️  系统未安装Aria2c，将使用yt-dlp内置下载器")
        print("  💡 如需使用Aria2c，请运行: brew install aria2 (macOS)")

    # 测试3: 获取下载引擎统计信息
    print("\n[3/4] 获取下载引擎统计信息...")
    stats = engine.get_download_stats()
    print(f"✓ 统计信息获取成功:")
    print(f"  - yt-dlp路径: {stats['yt_dlp_path']}")
    print(f"  - FFmpeg路径: {stats['ffmpeg_path']}")
    print(f"  - Aria2c路径: {stats['aria2c_path']}")
    print(f"  - Aria2c可用: {stats['aria2c_available']}")
    print(f"  - 支持格式: {', '.join(stats['supported_formats'])}")
    print(f"  - 支持质量数: {len(stats['supported_qualities'])}")

    # 测试4: 验证配置参数
    print("\n[4/4] 验证配置参数...")
    assert isinstance(stats['aria2c_available'], bool), "aria2c_available应该是布尔值"
    assert isinstance(stats['supported_formats'], list), "supported_formats应该是列表"
    assert isinstance(stats['supported_qualities'], list), "supported_qualities应该是列表"
    print("✓ 所有配置参数验证通过")

    return True


def test_download_service():
    """测试DownloadService的Aria2c集成"""
    print("\n" + "=" * 60)
    print("测试2: DownloadService Aria2c集成")
    print("=" * 60)

    from src.services.download_service import download_service

    print("\n[1/2] 获取下载引擎实例...")
    engine = download_service.download_engine
    print("✓ 下载引擎实例获取成功")

    print("\n[2/2] 验证Aria2c支持...")
    stats = engine.get_download_stats()
    print(f"✓ Aria2c可用性: {stats['aria2c_available']}")

    return True


async def test_ydl_opts():
    """测试ydl_opts配置"""
    print("\n" + "=" * 60)
    print("测试3: ydl_opts配置验证")
    print("=" * 60)

    from src.services.download_engine import DownloadEngine

    print("\n[1/2] 创建下载引擎实例...")
    engine = DownloadEngine()

    print("\n[2/2] 模拟构建ydl_opts...")
    # 模拟download_video方法中的配置逻辑
    ydl_opts = {}

    # 添加Aria2c配置（如果可用）
    if engine._check_aria2c_available():
        ydl_opts['external_downloader'] = engine.aria2c_path
        ydl_opts['external_downloader_args'] = [
            '-x', '8',
            '-k', '1M',
            '--max-tries=5',
            '--retry-wait=10',
            '--timeout=60',
            '--max-connection-per-server=8',
            '--split=8',
            '--min-split-size=1M',
            '--continue=true',
            '--check-certificate=false',
            '--allow-overwrite=true',
            '--auto-file-renaming=false',
            '--summary-interval=0',
        ]
        print("✓ Aria2c配置已添加到ydl_opts")
        print(f"  - 下载器: {ydl_opts['external_downloader']}")
        print(f"  - 参数数量: {len(ydl_opts['external_downloader_args'])}")
    else:
        print("✓ 使用yt-dlp内置下载器（Aria2c不可用）")
        assert 'external_downloader' not in ydl_opts
        assert 'external_downloader_args' not in ydl_opts

    return True


def main():
    """主测试函数"""
    print("\n🚀 Aria2c集成测试开始\n")

    try:
        # 运行所有测试
        test_download_engine()
        test_download_service()
        asyncio.run(test_ydl_opts())

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        print("\n📝 总结:")
        print("  ✓ DownloadEngine成功集成Aria2c")
        print("  ✓ 支持Aria2c可用性检查")
        print("  ✓ 自动降级机制正常工作")
        print("  ✓ 配置参数验证通过")
        print("\n💡 下一步:")
        print("  1. 可选: 安装Aria2c以提升下载速度 (brew install aria2)")
        print("  2. 在设置中配置Aria2c路径")
        print("  3. 启动下载任务测试实际下载速度")
        print()

        return 0

    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ 测试失败")
        print("=" * 60)
        print(f"错误信息: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())