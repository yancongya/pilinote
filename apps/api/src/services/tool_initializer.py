"""
工具初始化服务 - 自动检测并设置项目工具
"""
import os
import platform
import shutil
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ToolInitializer:
    """工具初始化服务"""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent.parent.parent
        self.tools_dir = self.script_dir / 'tools'
        
    def get_platform_dir(self) -> Optional[str]:
        """获取当前平台目录"""
        system = platform.system().lower()
        
        if system == 'darwin':
            return 'macos'
        elif system == 'linux':
            return 'linux'
        elif system == 'windows':
            return 'windows'
        else:
            logger.warning(f"不支持的操作系统: {system}")
            return None
    
    def check_tools_exist(self, platform_dir: str) -> bool:
        """检查工具是否存在"""
        tool_dir = self.tools_dir / platform_dir
        ffmpeg_path = tool_dir / 'ffmpeg'
        aria2c_path = tool_dir / 'aria2c'
        
        return ffmpeg_path.exists() and aria2c_path.exists()
    
    def copy_from_system(self, tool_name: str, dest_dir: Path) -> bool:
        """从系统复制工具"""
        # 检测工具路径
        tool_path = shutil.which(tool_name)
        if not tool_path:
            logger.warning(f"系统中未找到 {tool_name}")
            return False
        
        try:
            dest_path = dest_dir / tool_name
            shutil.copy(tool_path, dest_path)
            # 添加执行权限
            dest_path.chmod(0o755)
            logger.info(f"已复制 {tool_name} 到 {dest_path}")
            return True
        except Exception as e:
            logger.error(f"复制 {tool_name} 失败: {e}")
            return False
    
    def initialize_tools(self) -> Tuple[bool, str]:
        """初始化工具
        
        Returns:
            (是否成功, 消息)
        """
        platform_dir = self.get_platform_dir()
        if not platform_dir:
            return False, f"不支持的操作系统: {platform.system()}"
        
        # 检查工具是否已存在
        if self.check_tools_exist(platform_dir):
            logger.info(f"{platform_dir} 平台工具已存在")
            return True, f"{platform_dir} 平台工具已存在"
        
        # 创建目标目录
        dest_dir = self.tools_dir / platform_dir
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"开始初始化 {platform_dir} 平台工具...")
        
        # 尝试从系统复制 ffmpeg
        ffmpeg_success = self.copy_from_system('ffmpeg', dest_dir)
        
        # 尝试从系统复制 aria2c
        aria2c_success = self.copy_from_system('aria2c', dest_dir)
        
        # 检查结果
        if ffmpeg_success and aria2c_success:
            message = f"✅ {platform_dir} 平台工具初始化成功"
            logger.info(message)
            return True, message
        else:
            message = f"⚠️ {platform_dir} 平台工具初始化部分失败\n"
            message += f"ffmpeg: {'✅' if ffmpeg_success else '❌'}\n"
            message += f"aria2c: {'✅' if aria2c_success else '❌'}\n"
            message += "\n提示:\n"
            
            if not ffmpeg_success:
                message += "  - ffmpeg 未安装，请从 https://ffmpeg.org/download.html 下载\n"
            if not aria2c_success:
                message += "  - aria2c 未安装，请从 https://aria2.github.io/ 下载\n"
            
            message += f"\n或者运行: python3 {self.tools_dir / 'setup_tools.py'}"
            
            logger.warning(message)
            return False, message
    
    def get_tool_path(self, tool_name: str) -> Optional[str]:
        """获取工具路径
        
        Returns:
            工具路径，如果不存在则返回 None
        """
        platform_dir = self.get_platform_dir()
        if not platform_dir:
            return None
        
        tool_path = self.tools_dir / platform_dir / tool_name
        
        if tool_path.exists() and tool_path.is_file():
            return str(tool_path)
        
        return None


# 全局初始化函数
def initialize_tools_on_startup() -> None:
    """应用启动时初始化工具"""
    initializer = ToolInitializer()
    success, message = initializer.initialize_tools()
    
    if success:
        logger.info(message)
    else:
        logger.warning(message)