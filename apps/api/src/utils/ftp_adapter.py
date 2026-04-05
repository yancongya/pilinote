"""
FTP 适配器 - 用于文件备份和传输
"""
import logging
import ftplib
import os
from typing import Optional
from io import BytesIO

logger = logging.getLogger(__name__)


class FTPAdapter:
    """FTP 远程存储适配器"""
    
    def __init__(self, host: str, username: str, password: str, use_tls: bool = False):
        """
        初始化 FTP 适配器
        
        Args:
            host: FTP 服务器地址（可包含端口，如 ftp.example.com:21）
            username: 用户名
            password: 密码
            use_tls: 是否使用 TLS 加密（FTPS）
        """
        self.host = host
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.ftp = None
        
        # 从 host 字段中解析端口
        if ':' in host:
            self.host, port_str = host.rsplit(':', 1)
            try:
                self.port = int(port_str)
            except ValueError:
                self.port = 21
        else:
            self.port = 21
        
    def connect(self) -> bool:
        """连接到 FTP 服务器"""
        try:
            if self.use_tls:
                self.ftp = ftplib.FTP_TLS()
            else:
                self.ftp = ftplib.FTP()
            
            # 清理 host 字段，移除可能的协议前缀
            host = self.host.strip()
            if host.startswith('ftp://'):
                host = host[6:]
            elif host.startswith('ftps://'):
                host = host[7:]
            
            logger.info(f"Connecting to FTP server: {host}:{self.port}")
            self.ftp.connect(host, self.port)
            self.ftp.login(self.username, self.password)
            
            if self.use_tls:
                self.ftp.prot_p()  # 启用数据传输加密
            
            logger.info(f"FTP connection successful: {host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to FTP: {e}", exc_info=True)
            return False
    
    def test_connection(self) -> tuple[bool, str]:
        """测试连接"""
        try:
            if not self.connect():
                return False, "Failed to connect to FTP server"
            
            # 尝试列出当前目录
            self.ftp.pwd()
            logger.info(f"Successfully connected to FTP {self.host}:{self.port}")
            self.close()
            return True, "Connection successful"
        except Exception as e:
            logger.error(f"FTP connection test failed: {e}", exc_info=True)
            return False, f"Connection failed: {str(e)}"
    
    def close(self):
        """关闭连接"""
        if self.ftp:
            try:
                self.ftp.quit()
            except:
                try:
                    self.ftp.close()
                except:
                    pass
            self.ftp = None
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """
        上传单个文件到 FTP 服务器
        
        Args:
            local_path: 本地文件路径
            remote_path: 远程文件路径
        
        Returns:
            是否上传成功
        """
        try:
            logger.info(f"[DEBUG] upload_file called: {local_path} -> {remote_path}")
            
            if not os.path.exists(local_path):
                logger.error(f"Local file not found: {local_path}")
                return False
            
            # 确保远程目录存在
            remote_dir = os.path.dirname(remote_path)
            if remote_dir:
                logger.info(f"[DEBUG] Creating remote directory: {remote_dir}")
                self.mkdir(remote_dir)
            
            # 上传文件
            logger.info(f"[DEBUG] Uploading file to: {remote_path}")
            with open(local_path, 'rb') as f:
                self.ftp.storbinary(f'STOR {remote_path}', f)
            
            logger.info(f"Uploaded: {local_path} -> {remote_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to upload {local_path}: {e}", exc_info=True)
            return False
    
    def mkdir(self, remote_path: str) -> bool:
        """
        创建远程目录（支持递归创建）
        使用相对路径，从用户主目录开始
        
        Args:
            remote_path: 远程目录路径（相对路径）
        
        Returns:
            是否创建成功
        """
        try:
            logger.info(f"[DEBUG] mkdir called: {remote_path}")
            
            if not remote_path or remote_path == '.':
                return True
            
            # 移除前导斜杠，使用相对路径
            remote_path = remote_path.lstrip('/')
            
            # 如果已经是相对路径且没有目录分隔符，直接创建
            if '/' not in remote_path:
                try:
                    self.ftp.cwd(remote_path)
                    self.ftp.cwd('..')  # 返回上级目录
                    return True
                except ftplib.error_perm:
                    try:
                        self.ftp.mkd(remote_path)
                        logger.info(f"Created directory: {remote_path}")
                        return True
                    except Exception as e:
                        logger.error(f"Failed to create single directory {remote_path}: {e}")
                        return False
            
            # 分割路径，逐级创建
            parts = remote_path.split('/')
            
            logger.info(f"[DEBUG] Path parts: {parts}")
            
            # 保存当前工作目录
            original_path = self.ftp.pwd()
            logger.info(f"[DEBUG] Current working directory: {original_path}")
            
            for part in parts:
                if not part:
                    continue
                
                logger.info(f"[DEBUG] Checking/creating: {part}")
                
                # 检查目录是否存在
                try:
                    self.ftp.cwd(part)
                    logger.info(f"[DEBUG] Directory exists: {part}")
                except ftplib.error_perm:
                    # 目录不存在，创建它
                    try:
                        self.ftp.mkd(part)
                        logger.info(f"Created directory: {part}")
                        self.ftp.cwd(part)  # 进入新创建的目录
                    except ftplib.error_perm as e:
                        # 可能是路径包含非法字符或其他问题
                        logger.error(f"Failed to create directory {part}: {e}")
                        # 尝试回到原始目录
                        try:
                            self.ftp.cwd(original_path)
                        except:
                            pass
                        return False
                except Exception as e:
                    logger.error(f"Unexpected error checking/creating directory {part}: {e}")
                    return False
            
            # 返回到原始目录
            try:
                self.ftp.cwd(original_path)
            except:
                pass
            
            logger.info(f"Successfully created directory path: {remote_path}")
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
            # 尝试获取文件信息
            try:
                self.ftp.size(remote_path)
                return True
            except ftplib.error_perm:
                pass
            
            # 尝试切换到目录
            try:
                self.ftp.cwd(remote_path)
                self.ftp.cwd('..')
                return True
            except ftplib.error_perm:
                return False
        except Exception as e:
            logger.error(f"Check exists failed for {remote_path}: {e}")
            return False