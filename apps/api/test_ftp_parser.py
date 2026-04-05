#!/usr/bin/env python3
"""测试 FTP 地址解析"""

def parse_host(host: str) -> tuple[str, int]:
    """从 host 字段中解析主机和端口"""
    if ':' in host:
        parts = host.rsplit(':', 1)
        hostname = parts[0]
        try:
            port = int(parts[1])
        except ValueError:
            # 如果端口不是数字，使用默认端口
            port = 21
    else:
        hostname = host
        port = 21
    
    return hostname, port

# 测试用例
test_cases = [
    "192.168.31.110:21",
    "192.168.31.110",
    "ftp.example.com:2121",
    "ftp.example.com",
    "localhost",
    "localhost:2121",
]

print("测试 FTP 地址解析...")
print("=" * 60)

for test in test_cases:
    host, port = parse_host(test)
    print(f"输入: {test:30s} -> 主机: {host:20s} 端口: {port}")

print("=" * 60)
print("测试完成")
