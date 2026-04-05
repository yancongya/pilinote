#!/usr/bin/env python3
"""
测试 WebDAV 目录创建权限
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.utils.webdav_adapter import WebDAVAdapter

def test_mkdir():
    # 使用你的 WebDAV 配置
    adapter = WebDAVAdapter(
        url="http://192.168.31.110:5005",
        username="admin",
        password="admin",
        verify_ssl=False
    )

    print("测试目录创建权限...")
    print("=" * 50)

    # 测试创建不同层级的目录
    test_paths = [
        "/pilinote",                    # 根目录
        "/pilinote/downloads",          # 一级子目录
        "/pilinote/downloads/test",     # 二级子目录
        "/pilinote/downloads/test/deep",# 三级子目录
    ]

    for path in test_paths:
        try:
            adapter.connect()
            success = adapter.mkdir(path)
            status = "✓ 成功" if success else "✗ 失败"
            print(f"{status}: {path}")
        except Exception as e:
            print(f"✗ 异常: {path} - {e}")

    print("=" * 50)
    print("测试完成")

if __name__ == "__main__":
    test_mkdir()