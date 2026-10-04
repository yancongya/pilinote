#!/usr/bin/env python3
"""
Aria2c下载测试脚本
"""
import sys
import asyncio
import time
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))


async def test_aria2c_download():
    """测试使用Aria2c下载视频"""
    print("=" * 60)
    print("Aria2c下载测试")
    print("=" * 60)

    from src.database import SessionLocal
    from src.services.settings_service import SettingsService
    from src.services.download_engine import DownloadEngine
    from src.services.download_service import download_service

    # 测试视频信息（使用一个较短的测试视频）
    test_bvid = "BV1xx411c7mD"  # B站测试视频
    test_title = "Aria2c下载测试"

    print(f"\n测试视频: {test_bvid}")
    print(f"视频标题: {test_title}")

    # 获取下载引擎
    with SessionLocal() as db:
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        engine = DownloadEngine(settings)

    print(f"\n下载引擎配置:")
    print(f"  - Aria2c可用: {engine._check_aria2c_available()}")
    print(f"  - Aria2c路径: {engine.aria2c_path}")
    print(f"  - FFmpeg路径: {engine.ffmpeg_path}")

    if not engine._check_aria2c_available():
        print("\n❌ Aria2c不可用，跳过下载测试")
        print("💡 请确保已安装Aria2c并正确配置路径")
        return False

    print("\n✓ Aria2c可用，开始下载测试")
    print("=" * 60)

    # 记录开始时间
    start_time = time.time()

    # 创建临时目录
    temp_dir = Path("./temp/aria2c_test")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 创建进度回调函数
        progress_updates = []

        def progress_callback(bvid, progress, downloaded_bytes, total_bytes, download_speed, eta):
            progress_updates.append({
                'progress': progress,
                'downloaded_bytes': downloaded_bytes,
                'total_bytes': total_bytes,
                'download_speed': download_speed,
                'eta': eta,
                'timestamp': time.time()
            })
            print(f"\r进度: {progress:.1f}% | "
                  f"已下载: {downloaded_bytes / 1024 / 1024:.2f} MB | "
                  f"总大小: {total_bytes / 1024 / 1024:.2f} MB | "
                  f"速度: {download_speed:.1f} KB/s | "
                  f"剩余时间: {eta}秒", end='', flush=True)

        print("\n开始下载...")
        print("-" * 60)

        # 执行下载
        await engine.download_video(
            bvid=test_bvid,
            quality=64,  # 720P
            output_format="mp4",
            output_path=str(temp_dir),
            progress_callback=progress_callback
        )

        # 计算总下载时间
        total_time = time.time() - start_time

        print("\n" + "=" * 60)
        print("✓ 下载完成！")
        print("=" * 60)

        # 计算平均速度
        if progress_updates:
            first_update = progress_updates[0]
            last_update = progress_updates[-1]

            total_downloaded = last_update['downloaded_bytes']
            avg_speed = total_downloaded / total_time / 1024  # KB/s

            print(f"\n下载统计:")
            print(f"  - 总下载时间: {total_time:.2f} 秒")
            print(f"  - 下载文件大小: {total_downloaded / 1024 / 1024:.2f} MB")
            print(f"  - 平均下载速度: {avg_speed:.1f} KB/s ({avg_speed / 1024:.2f} MB/s)")
            print(f"  - 进度更新次数: {len(progress_updates)}")

            # 列出下载的文件
            print(f"\n下载文件:")
            for file in temp_dir.rglob('*'):
                if file.is_file():
                    file_size = file.stat().st_size
                    print(f"  - {file.name} ({file_size / 1024 / 1024:.2f} MB)")

            return True
        else:
            print("\n⚠️  没有收到进度更新")
            return False

    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试函数"""
    print("\n🚀 Aria2c下载测试开始\n")

    try:
        success = asyncio.run(test_aria2c_download())

        if success:
            print("\n" + "=" * 60)
            print("✅ Aria2c下载测试成功！")
            print("=" * 60)
            print("\n📝 总结:")
            print("  ✓ Aria2c配置正确")
            print("  ✓ 下载功能正常")
            print("  ✓ 进度回调工作正常")
            print("\n💡 提示:")
            print("  - 可以对比yt-dlp内置下载器的速度")
            print("  - Aria2c应该能提供30-50%的速度提升")
            print("  - 测试文件保存在 ./temp/aria2c_test 目录")
            print()

            return 0
        else:
            print("\n❌ 下载测试失败")
            return 1

    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断测试")
        return 130
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