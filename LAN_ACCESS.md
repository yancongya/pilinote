# 局域网访问配置

## 如何在局域网内其他设备访问 PiliNote

### 1. 获取本机 IP 地址

在 Mac 上打开终端，运行：
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

在 Windows 上打开命令提示符，运行：
```bash
ipconfig
```

找到你的局域网 IP 地址，例如：`192.168.31.100`

### 2. 启动后端服务

```bash
cd apps/api
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 启动前端服务

```bash
cd apps/web
pnpm dev
```

### 4. 从其他设备访问

#### 从电脑访问
打开浏览器，访问：
```
http://192.168.31.100:5173
```

#### 从手机访问
确保手机和电脑在同一个 Wi-Fi 网络，然后访问：
```
http://192.168.31.100:5173
```

### 5. 工作原理

- **前端**：运行在 `http://0.0.0.0:5173`，自动检测访问的主机名
- **后端**：运行在 `http://0.0.0.0:8000`，接受所有网络接口的连接
- **数据库**：所有设备共享同一个 `pilinote.db` 文件

### 6. 注意事项

1. **防火墙设置**：
   - 确保防火墙允许端口 5173 和 8000 的入站连接
   - Mac：系统偏好设置 → 安全性与隐私 → 防火墙
   - Windows：Windows 防火墙 → 允许应用通过防火墙

2. **网络连接**：
   - 所有设备必须连接到同一个 Wi-Fi 网络
   - 某些企业网络可能禁止设备间通信

3. **数据库共享**：
   - 所有设备共享同一个数据库文件
   - 建议不要同时从多个设备进行下载操作

### 7. 快速启动脚本

创建一个快速启动脚本 `start-lan.sh`：

```bash
#!/bin/bash

echo "正在启动 PiliNote 局域网服务..."

# 获取本机 IP
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

echo "本机 IP: $IP"
echo "前端访问地址: http://$IP:5173"
echo "后端 API 地址: http://$IP:8000"
echo ""

# 启动后端
cd apps/api
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/pilinote-api.log 2>&1 &
echo "后端服务已启动 (PID: $!)"

# 启动前端
cd ../web
nohup pnpm dev > /tmp/pilinote-web.log 2>&1 &
echo "前端服务已启动 (PID: $!)"

echo ""
echo "服务已启动！"
echo "查看日志："
echo "  后端: tail -f /tmp/pilinote-api.log"
echo "  前端: tail -f /tmp/pilinote-web.log"
echo ""
echo "停止服务："
echo "  killall uvicorn pnpm"
```

使用方法：
```bash
chmod +x start-lan.sh
./start-lan.sh
```

### 8. 故障排查

**问题：无法访问**
- 检查防火墙设置
- 确认设备在同一网络
- 尝试关闭 VPN

**问题：数据库错误**
- 确保 `pilinote.db` 文件存在
- 检查文件权限

**问题：WebSocket 连接失败**
- 检查后端服务是否正常运行
- 确认端口 8000 未被占用
