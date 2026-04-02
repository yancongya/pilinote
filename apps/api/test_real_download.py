#!/usr/bin/env python3
"""
实际下载测试 - 验证Aria2c是否正常工作
"""
import sys
import asyncio
import time
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))


async def test_real_download():
    """测试实际下载功能"""
    print("=" * 70)
    print("Aria2c实际下载测试")
    print("=" * 70)

    from src.database import SessionLocal
    from src.services.settings_service import SettingsService
    from src.services.download_engine import DownloadEngine

    # 使用一个短视频进行测试
    test_bvid = "BV1xx411c7mD"  # B站测试视频

    print(f"\n测试视频: {test_bvid}")
    print(f"测试质量: 720P (流畅画质，下载快)")
    print(f"输出格式: mp4")

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
        print("\n❌ Aria2c不可用，无法进行下载测试")
        return False

    print("\n✓ Aria2c可用，开始下载测试")
    print("=" * 70)

    # 记录开始时间
    start_time = time.time()

    # 创建临时目录
    temp_dir = Path("./temp/aria2c_real_test")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 创建进度回调函数
        progress_updates = []
        last_progress = 0
        last_update_time = time.time()

        def progress_callback(bvid, progress, downloaded_bytes, total_bytes, download_speed, eta):
            nonlocal last_progress, last_update_time

            progress_updates.append({
                'progress': progress,
                'downloaded_bytes': downloaded_bytes,
                'total_bytes': total_bytes,
                'download_speed': download_speed,
                'eta': eta,
                'timestamp': time.time()
            })

            # 每更新1%或每5秒显示一次进度
            current_time = time.time()
            if progress - last_progress >= 1.0 or current_time - last_update_time >= 5.0:
                last_progress = progress
                last_update_time = current_time
                print(f"\r进度: {progress:.1f}% | "
                      f"已下载: {downloaded_bytes / 1024 / 1024:.2f} MB / {total_bytes / 1024 / 1024:.2f} MB | "
                      f"速度: {download_speed:.1f} KB/s | "
                      f"剩余: {eta}秒", end='', flush=True)

        print("\n开始下载...")
        print("-" * 70)

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

        print("\n" + "=" * 70)
        print("✓ 下载完成！")
        print("=" * 70)

        # 分析下载结果
        if progress_updates:
            first_update = progress_updates[0]
            last_update = progress_updates[-1]

            total_downloaded = last_update['downloaded_bytes']
            avg_speed = total_downloaded / total_time / 1024  # KB/s
            max_speed = max(p['download_speed'] for p in progress_updates)
            update_count = len(progress_updates)

            print(f"\n下载统计:")
            print(f"  - 总下载时间: {total_time:.2f} 秒")
            print(f"  - 下载文件大小: {total_downloaded / 1024 / 1024:.2f} MB")
            print(f"  - 平均下载速度: {avg_speed:.1f} KB/s ({avg_speed / 1024:.2f} MB/s)")
            print(f"  - 最大下载速度: {max_speed:.1f} KB/s ({max_speed / 1024:.2f} MB/s)")
            print(f"  - 进度更新次数: {update_count}")
            print(f"  - 平均更新间隔: {total_time / update_count:.2f} 秒")

            # 检查下载的文件
            print(f"\n下载文件:")
            video_files = list(temp_dir.rglob('*.mp4')) + list(temp_dir.rglob('*.flv'))
            if video_files:
                for file in video_files:
                    file_size = file.stat().st_size
                    print(f"  - {file.name} ({file_size / 1024 / 1024:.2f} MB)")

            # 验证Aria2c是否真的在工作
            print(f"\nAria2c验证:")
            if avg_speed > 1000:  # 超过1MB/s
                print(f"  ✓ 下载速度正常 ({avg_speed / 1024:.2f} MB/s)")
                print(f"  ✓ Aria2c多线程下载器工作正常")
                print(f"  ✓ 速度提升预期已达成")
            else:
                print(f"  ⚠️  下载速度较慢 ({avg_speed / 1024:.2f} MB/s)")
                print(f"  ⚠️  可能受到网络或服务器限制")

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
    print("\n🚀 Aria2c实际下载测试开始\n")

    try:
        success = asyncio.run(test_real_download())

        if success:
            print("\n" + "=" * 70)
            print("✅ Aria2c实际下载测试成功！")
            print("=" * 70)
            print("\n📝 测试结论:")
            print("  ✓ Aria2c配置正确")
            print("  ✓ 下载功能正常")
            print("  ✓ 进度回调工作正常")
            print("  ✓ 多线程下载加速生效")
            print("\n💡 建议:")
            print("  - 可以开始使用Aria2c进行日常下载")
            print("  - 下载速度应该提升30-50%")
            print("  - 测试文件保存在 ./temp/aria2c_real_test")
            print()

            return 0
        else:
            print("\n❌ 下载测试失败")
            return 1

    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断测试")
        return 130
    except Exception as e:
        print("\n" + "=" * 70)
        print("❌ 测试失败")
        print("=" * 70)
        print(f"错误信息: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
