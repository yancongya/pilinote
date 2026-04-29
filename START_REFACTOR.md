# 开始重构 - 准备工作

## 1. 创建重构分支
```bash
git checkout -b refactor/download-system
git push -u origin refactor/download-system
```

## 2. 备份当前数据
```bash
cd apps/api
# 备份数据库
cp data/pilinote.db data/pilinote.db.backup

# 导出当前下载数据
sqlite3 data/pilinote.db ".dump downloads" > downloads_backup.sql
```

## 3. 设置开发环境
```bash
# 后端
cd apps/api
source venv/bin/activate
pip install -r requirements.txt

# 前端
cd apps/web
pnpm install
```

## 4. 运行现有测试（如果有）
```bash
# 确保当前系统正常工作
cd apps/api
python -m pytest tests/ -v

cd apps/web
pnpm test
```

## 5. 创建重构跟踪文件
```bash
touch REFACTOR_PROGRESS.md
```

## 下一步
1. 仔细阅读各阶段计划（REFACTOR_PHASE1.md 到 REFACTOR_PHASE5.md）
2. 从阶段1开始执行
3. 每完成一个阶段，在 REFACTOR_PROGRESS.md 中记录进度
4. 遇到问题随时咨询

## 预计时间安排
- 阶段1（数据层）：1-2天
- 阶段2（后端服务）：2-3天  
- 阶段3（前端状态）：2天
- 阶段4（元数据系统）：2-3天
- 阶段5（测试清理）：1-2天

**总计：8-12天**

## 风险控制
1. 每个阶段完成后提交代码
2. 保持数据库备份
3. 可以随时回滚到上一个稳定版本
4. 分阶段测试，确保每个阶段都能正常工作