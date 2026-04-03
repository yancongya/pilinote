"""
初始化缺失的设置
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.database import SessionLocal
from src.services.settings_service import SettingsService

def init_missing_settings():
    """初始化缺失的设置"""
    db = SessionLocal()
    try:
        service = SettingsService(db)

        # 检查缺失的设置
        all_settings = service.get_all_settings()
        missing_settings = []

        # 检查 download_path
        if 'storage.download_path' not in all_settings:
            missing_settings.append('storage.download_path')
            service._update_single_setting('storage.download_path', './downloads')
            print('✓ 添加 storage.download_path')

        # 检查 sidecar
        if 'storage.sidecar' not in all_settings:
            missing_settings.append('storage.sidecar')

            # 获取真实工具路径
            import shutil
            ffmpeg_path = shutil.which('ffmpeg') or 'ffmpeg'
            aria2c_path = shutil.which('aria2c') or 'aria2c'

            # 尝试获取项目内工具路径
            try:
                from src.services.tool_initializer import ToolInitializer
                initializer = ToolInitializer()
                project_ffmpeg = initializer.get_tool_path('ffmpeg')
                project_aria2c = initializer.get_tool_path('aria2c')

                if project_ffmpeg:
                    ffmpeg_path = project_ffmpeg
                    print(f'✓ 使用项目内 FFmpeg: {ffmpeg_path}')
                if project_aria2c:
                    aria2c_path = project_aria2c
                    print(f'✓ 使用项目内 Aria2c: {aria2c_path}')
            except Exception as e:
                print(f'⚠ 无法获取项目内工具路径，使用系统路径: {e}')

            import json
            sidecar_value = json.dumps({
                'ffmpeg': ffmpeg_path,
                'aria2c': aria2c_path
            })
            service._update_single_setting('storage.sidecar', sidecar_value)
            print(f'✓ 添加 storage.sidecar: {sidecar_value}')

        if missing_settings:
            print(f'\n✅ 成功初始化 {len(missing_settings)} 个缺失的设置')
        else:
            print('\n✅ 所有设置都已存在，无需初始化')

    except Exception as e:
        print(f'\n❌ 初始化失败: {e}')
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    init_missing_settings()