# 开发路线图

## Phase 1: 核心功能 (Week 1-2)
- [ ] 搭建FastAPI后端框架
- [ ] 搭建React前端框架
- [ ] 实现SESSDATA认证
- [ ] 集成yt-dlp基础下载
- [ ] 实现SQLite数据库

## Phase 2: 视频源管理 (Week 3)
- [ ] 实现收藏夹API
- [ ] 实现稍后再看API
- [ ] 实现链接智能识别
- [ ] 前端视频源页面

## Phase 3: 下载管理 (Week 4)
- [ ] 集成Celery + Redis
- [ ] 实现下载队列
- [ ] WebSocket进度推送
- [ ] 前端下载管理页面

## Phase 4: 文件组织 (Week 5)
- [ ] 自动下载字幕/弹幕
- [ ] 音轨提取
- [ ] 元数据保存
- [ ] 文件夹组织逻辑

## Phase 5: 部署优化 (Week 6)
- [ ] Docker Compose配置
- [ ] Caddy反向代理
- [ ] 环境变量管理
- [ ] 生产环境优化

## Phase 6: 桌面端 (Week 7-8)
- [ ] Electron基础框架
- [ ] 打包配置
- [ ] 跨平台测试
- [ ] 发布流程

## 参考资源
- `reference/pilipala/` - 认证和API实现
- `reference/hermes/` - 架构和部署
- `reference/vidbee/` - Electron实现