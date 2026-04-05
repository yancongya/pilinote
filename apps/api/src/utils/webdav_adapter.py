"""
WebDAV 适配器 - 用于文件备份和传输
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class WebDAVAdapter:
    """WebDAV 远程存储适配器"""
    
    def __init__(self, url: str, username: str, password: str, verify_ssl: bool = False):
        """
        初始化 WebDAV 适配器
        
        Args:
            url: WebDAV 服务器 URL
            username: 用户名
            password: 密码
            verify_ssl: 是否验证 SSL 证书
        """
        self.url = url
        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.client = None
        
    def connect(self) -> bool:
        """连接到 WebDAV 服务器"""
        try:
            from webdav3.client import Client
            import requests
            
            options = {
                'webdav_hostname': self.url,
                'webdav_login': self.username,
                'webdav_password': self.password,
                'disable_check': True,  # 禁用连接检查
                'timeout': 30,  # 超时时间
            }
            
            self.client = Client(options)
            
            # 如果禁用 SSL 验证，修改 session
            if not self.verify_ssl:
                import urllib3
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                
                # 修改 session 禁用 SSL 验证
                if hasattr(self.client, 'session'):
                    self.client.session.verify = False
                # 修改 HTTP 请求的 verify
                if hasattr(self.client, 'http'):
                    if hasattr(self.client.http, 'session'):
                        self.client.http.session.verify = False
            
            logger.info(f"WebDAV client initialized: {self.url}, verify_ssl={self.verify_ssl}")
            return True
        except ImportError:
            logger.error("webdav3 not installed. Please install: pip install webdavclient3")
            return False
        except Exception as e:
            logger.error(f"Failed to connect to WebDAV: {e}", exc_info=True)
            return False
    
    def test_connection(self) -> tuple[bool, str]:
        """测试连接"""
        try:
            # 先尝试连接
            if not self.connect():
                return False, "Failed to initialize WebDAV client. Please check if webdavclient3 is installed."
            
            # 尝试列出根目录
            logger.info(f"Attempting to list root directory...")
            self.client.list('/')
            logger.info(f"Successfully connected to {self.url}")
            return True, "Connection successful"
        except ImportError as e:
            logger.error(f"Import error: {e}")
            return False, "webdavclient3 not installed. Please run: pip install webdavclient3"
        except Exception as e:
            logger.error(f"WebDAV connection test failed: {e}", exc_info=True)
            return False, f"Connection failed: {str(e)}"
    
    def close(self):
        """关闭连接"""
        self.client = None
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """
        上传单个文件到 WebDAV 服务器
        
        Args:
            local_path: 本地文件路径
            remote_path: 远程文件路径
        
        Returns:
            是否上传成功
        """
        try:
            import os
            from pathlib import Path
            
            logger.info(f"[DEBUG] upload_file called: {local_path} -> {remote_path}")
            
            if not os.path.exists(local_path):
                logger.error(f"Local file not found: {local_path}")
                return False
            
            # 确保远程目录存在
            remote_dir = str(Path(remote_path).parent)
            logger.info(f"[DEBUG] Creating remote directory: {remote_dir}")
            self.mkdir(remote_dir)
            
            # 上传文件
            logger.info(f"[DEBUG] Uploading file to: {remote_path}")
            self.client.upload_sync(
                remote_path=remote_path,
                local_path=local_path
            )
            
            logger.info(f"Uploaded: {local_path} -> {remote_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to upload {local_path}: {e}", exc_info=True)
            return False
    
    def mkdir(self, remote_path: str) -> bool:
        """
        创建远程目录（支持递归创建）
        
        Args:
            remote_path: 远程目录路径
        
        Returns:
            是否创建成功
        """
        try:
            logger.info(f"[DEBUG] mkdir called: {remote_path}")
            
            # 如果目录已存在，直接返回
            if self.client.check(remote_path):
                logger.info(f"[DEBUG] Directory already exists: {remote_path}")
                return True
            
            logger.info(f"[DEBUG] Directory does not exist, creating: {remote_path}")
            
            # 分割路径，逐级创建
            parts = remote_path.strip('/').split('/')
            current_path = ''
            
            logger.info(f"[DEBUG] Path parts: {parts}")
            
            for part in parts:
                current_path = f"{current_path}/{part}" if current_path else f"/{part}"
                
                logger.info(f"[DEBUG] Checking: {current_path}")
                
                if not self.client.check(current_path):
                    logger.info(f"Creating directory: {current_path}")
                    self.client.mkdir(current_path)
                else:
                    logger.info(f"[DEBUG] Directory exists: {current_path}")
            
            logger.info(f"Created directory: {remote_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to create directory {remote_path}: {e}", exc_info=True)
            return False
    
    def check_exists(self, remote_path: str) -> bool:
        """
        检查远程文件或目录是否存在
        
        Args:
            remote_path: 远程路径
        
        Returns:
            是否存在
        """
        try:
            # 方法1: 使用 check 方法
            try:
                exists = self.client.check(remote_path)
                logger.info(f"Check exists (method 1): {remote_path} -> {exists}")
                if exists:
                    # 如果 check 返回 True，再验证一下
                    try:
                        self.client.info(remote_path)
                        return True
                    except:
                        logger.warning(f"Check returned True but file doesn't exist: {remote_path}")
                        return False
                return False
            except Exception as e:
                logger.warning(f"Check method failed for {remote_path}: {e}")
                
                # 方法2: 使用 list 方法检查
                try:
                    parent_dir = str(Path(remote_path).parent)
                    file_name = str(Path(remote_path).name)
                    
                    if parent_dir == '.':
                        parent_dir = '/'
                    else:
                        parent_dir = f'/{parent_dir}'
                    
                    # 获取父目录的文件列表
                    files = self.client.list(parent_dir)
                    exists = file_name in files
                    
                    logger.info(f"Check exists (method 2): {remote_path} -> {exists} (files in {parent_dir}: {len(files)})")
                    return exists
                except Exception as e2:
                    logger.error(f"List method also failed for {remote_path}: {e2}")
                    return False
        except Exception as e:
            logger.error(f"Check exists failed for {remote_path}: {e}")
            return False