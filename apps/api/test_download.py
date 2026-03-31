"""
测试下载功能 - 验证不同参数配置
"""
import sys
import os
import asyncio
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.download_engine import DownloadEngine
from src.services.settings_service import SettingsService
from src.database import SessionLocal


async def test_download():
    """测试下载功能"""
    
    print("=" * 60)
    print("下载功能测试")
    print("=" * 60)
    
    # 获取当前设置
    with SessionLocal() as db:
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
    
    print(f"\n当前设置:")
    print(f"  默认分辨率: {settings.download.video.default_quality}")
    print(f"  音频码率: {settings.download.video.audio_bitrate}")
    print(f"  编码格式: {settings.download.video.codec}")
    print(f"  输出格式: {settings.download.video.output_format}")
    print(f"  下载路径: {settings.storage.download_path}")
    
    # 创建下载引擎
    engine = DownloadEngine(settings)
    
    # 测试视频
    test_bvid = "BV1GJ411x7h7"  # Rick Astley - Never Gonna Give You Up
    test_quality = 64  # 720P
    test_codec = "avc"  # H.264
    test_audio_bitrate = 192  # 192K
    test_format = "mp4"
    test_output_path = f"./test_downloads/{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    print(f"\n测试参数:")
    print(f"  BVID: {test_bvid}")
    print(f"  分辨率: {test_quality} (720P)")
    print(f"  编码: {test_codec} (H.264)")
    print(f"  音频码率: {test_audio_bitrate}K")
    print(f"  输出格式: {test_format}")
    print(f"  输出路径: {test_output_path}")
    
    # 进度回调
    def progress_callback(bvid, progress, downloaded_bytes, total_bytes, download_speed, eta):
        print(f"  进度: {progress:.1f}% | 速度: {download_speed:.1f} KB/s | ETA: {eta:.0f}s")
    
    try:
        print("\n开始下载...")
        await engine.download_video(
            bvid=test_bvid,
            quality=test_quality,
            output_format=test_format,
            output_path=test_output_path,
            sessdata=None,  # 使用公开视频，不需要SESSDATA
            progress_callback=progress_callback,
            audio_bitrate=test_audio_bitrate,
            codec=test_codec
        )
        
        print(f"\n✅ 下载完成！")
        print(f"文件保存在: {test_output_path}")
        
        # 检查下载的文件
        output_dir = os.path.abspath(test_output_path)
        if os.path.exists(output_dir):
            files = os.listdir(output_dir)
            print(f"\n下载的文件:")
            for f in files:
                file_path = os.path.join(output_dir, f)
                file_size = os.path.getsize(file_path)
                print(f"  {f} ({file_size:,} bytes)")
        
        # 测试不同的参数组合
        print(f"\n支持的分辨率:")
        qualities = engine.get_supported_qualities()
        for q in qualities:
            print(f"  {q['qn']}: {q['desc']} ({q['height']}p)")
        
        print(f"\n支持的格式:")
        formats = engine.get_supported_formats()
        for f in formats:
            print(f"  {f}")
        
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_download())