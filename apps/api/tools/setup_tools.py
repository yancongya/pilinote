#!/usr/bin/env python3
"""
工具安装脚本 - 复制系统中的 ffmpeg 和 aria2c 到项目目录
"""
import os
import platform
import shutil
from pathlib import Path

def detect_and_copy_tool(tool_name: str, dest_dir: Path) -> bool:
    """检测并复制工具"""
    # 检测工具路径
    tool_path = shutil.which(tool_name)
    if not tool_path:
        print(f"❌ 未找到 {tool_name}")
        return False
    
    print(f"✓ 找到 {tool_name}: {tool_path}")
    
    # 复制工具
    dest_path = dest_dir / tool_name
    try:
        shutil.copy(tool_path, dest_path)
        # 添加执行权限
        dest_path.chmod(0o755)
        print(f"✓ 已复制到: {dest_path}")
        return True
    except Exception as e:
        print(f"❌ 复制失败: {e}")
        return False

def main():
    """主函数"""
    # 获取当前系统平台
    system = platform.system().lower()
    
    if system == 'darwin':
        platform_dir = 'macos'
    elif system == 'linux':
        platform_dir = 'linux'
    elif system == 'windows':
        platform_dir = 'windows'
    else:
        print(f"❌ 不支持的平台: {system}")
        return
    
    # 创建目标目录
    script_dir = Path(__file__).parent
    dest_dir = script_dir / platform_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📦 开始设置工具（平台: {platform_dir}）")
    print(f"📂 目标目录: {dest_dir}")
    print()
    
    # 检测并复制 ffmpeg
    print("检测 ffmpeg...")
    ffmpeg_success = detect_and_copy_tool('ffmpeg', dest_dir)
    print()
    
    # 检测并复制 aria2c
    print("检测 aria2c...")
    aria2c_success = detect_and_copy_tool('aria2c', dest_dir)
    print()
    
    # 总结
    if ffmpeg_success and aria2c_success:
        print("✅ 所有工具设置完成！")
    else:
        print("⚠️  部分工具设置失败")
        print()
        print("💡 提示：")
        print("  - macOS: brew install ffmpeg aria2")
        print("  - Ubuntu: sudo apt install ffmpeg aria2")
        print("  - Arch: sudo pacman -S ffmpeg aria2")
        print("  - Windows: 从官方下载并放入相应目录")

if __name__ == '__main__':
    main()