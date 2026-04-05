#!/usr/bin/env python3
"""
测试 FTP 连接
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import ftplib

def test_ftp():
    print("测试 FTP 连接...")
    print("=" * 50)
    
    # 使用你的 FTP 配置
    host = "192.168.31.110"
    port = 21
    username = "admin"
    password = "admin"
    
    try:
        ftp = ftplib.FTP()
        print(f"正在连接到 {host}:{port}...")
        ftp.connect(host, port, timeout=10)
        print(f"✓ 连接成功")
        
        print(f"正在登录...")
        ftp.login(username, password)
        print(f"✓ 登录成功")
        
        print(f"当前目录: {ftp.pwd()}")
        
        print(f"文件列表:")
        files = ftp.nlst()
        for f in files[:10]:  # 只显示前 10 个文件
            print(f"  - {f}")
        
        ftp.quit()
        print("\n测试成功！")
        return True
        
    except ftplib.error_perm as e:
        print(f"✗ 权限错误: {e}")
        return False
    except ftplib.error_temp as e:
        print(f"✗ 临时错误: {e}")
        return False
    except ftplib.error_reply as e:
        print(f"✗ 响应错误: {e}")
        return False
    except Exception as e:
        print(f"✗ 连接失败: {e}")
        return False

if __name__ == "__main__":
    test_ftp()