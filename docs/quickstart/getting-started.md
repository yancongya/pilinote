# 快速开始

## 环境要求

- **Node.js**: >= 18
- **Python**: >= 3.10
- **pnpm**: 用于前端包管理
- **aria2c**: 下载引擎（可选）

## 安装步骤

### 前端

```bash
cd apps/web
pnpm install
```

### 后端

```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 启动

### 前端
```bash
./start-web.command
# 访问 http://localhost:5173
```

### 后端
```bash
./start-api.command
# 访问 http://localhost:8000
```

## 常见问题

> 待补充