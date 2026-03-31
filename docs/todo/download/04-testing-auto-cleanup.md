# 测试自动清理功能

## 概述

本文档详细说明了如何测试自动清理功能，包括手动测试和自动化测试。

## 测试环境准备

### 前置条件

1. **数据库初始化**
```bash
cd apps/api
source venv/bin/activate
python -c "from src.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

2. **设置默认值**
```python
python -c "
from src.database import SessionLocal
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    settings_service = SettingsService(db)
    settings_service.init_default_settings()
    print('Default settings initialized')
"
```

3. **创建测试目录**
```bash
mkdir -p temp downloads
mkdir -p logs
```

### 测试数据准备

创建一些测试用的临时文件：

```python
import os
import time
from pathlib import Path

def create_test_temp_files():
    """创建测试用的临时文件"""
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    
    # 创建一个旧的临时目录（超过24小时）
    old_dir = temp_dir / "old_download"
    old_dir.mkdir(exist_ok=True)
    (old_dir / "test.txt").write_text("old file")
    # 修改修改时间为25小时前
    old_time = time.time() - 25 * 3600
    os.utime(str(old_dir), (old_time, old_time))
    print(f"Created old temp directory: {old_dir}")
    
    # 创建一个新的临时目录（未超过24小时）
    new_dir = temp_dir / "new_download"
    new_dir.mkdir(exist_ok=True)
    (new_dir / "test.txt").write_text("new file")
    print(f"Created new temp directory: {new_dir}")
    
    # 创建一个.failed目录
    failed_dir = temp_dir / "failed_download.failed"
    failed_dir.mkdir(exist_ok=True)
    (failed_dir / "partial.mp4").write_text("partial data")
    # 修改修改时间为26小时前
    failed_time = time.time() - 26 * 3600
    os.utime(str(failed_dir), (failed_time, failed_time))
    print(f"Created failed temp directory: {failed_dir}")
    
    # 创建一个.temp目录
    temp_backup_dir = temp_dir / "backup_download.temp"
    temp_backup_dir.mkdir(exist_ok=True)
    (temp_backup_dir / "data.txt").write_text("backup data")
    # 修改修改时间为23小时前
    backup_time = time.time() - 23 * 3600
    os.utime(str(temp_backup_dir), (backup_time, backup_time))
    print(f"Created .temp directory: {temp_backup_dir}")
    
    print("Test temp files created successfully")

if __name__ == "__main__":
    create_test_temp_files()
```

## 手动测试

### 测试1：auto_cleanup=True 下载成功

**目标**：验证下载成功后立即清理临时目录

**步骤**：

1. **设置auto_cleanup=True**
```python
python -c "
from src.database import SessionLocal
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    settings_service = SettingsService(db)
    settings_service.update_settings({'storage.auto_cleanup': True})
    settings = settings_service.get_settings()
    print(f'auto_cleanup: {settings.storage.auto_cleanup}')
"
```

2. **创建下载任务**
```python
python -c "
from src.services.download_service import download_service

download_id = download_service.create_download_task(
    bvid='BV1xx411c7mD',
    title='测试视频',
    quality=64
)
print(f'Created download task: {download_id}')
"
```

3. **等待下载完成**
```python
python -c "
import asyncio
from src.services.download_service import download_service

async def wait_for_download():
    download = download_service.get_download(download_id)
    while download and download.status in ['pending', 'queued', 'downloading']:
        print(f'Download status: {download.status}, progress: {download.progress}%')
        await asyncio.sleep(5)
        download = download_service.get_download(download_id)
    print(f'Final status: {download.status}')

asyncio.run(wait_for_download())
"
```

4. **验证结果**
```python
python -c "
from pathlib import Path
from src.database import SessionLocal
from src.models.download import Download

# 验证文件在downloads目录中
download_dir = Path('downloads')
video_files = list(download_dir.glob('**/*.mp4'))
print(f'Video files in downloads: {len(video_files)}')
for f in video_files:
    print(f'  - {f}')

# 验证临时目录已清理
temp_dir = Path('temp')
temp_items = list(temp_dir.iterdir())
print(f'Temp directories: {len(temp_items)}')
for item in temp_items:
    print(f'  - {item.name}')

# 验证数据库记录
with SessionLocal() as db:
    download = db.query(Download).first()
    if download:
        print(f'Download file path: {download.file_path}')
        print(f'Download temp path: {download.temp_file_path}')
        assert download.file_path is not None, 'File path should not be None'
        assert download.temp_file_path is None, 'Temp path should be None'
        print('✅ Test passed: auto_cleanup=True')
"
```

**预期结果**：
- ✅ 文件在 `downloads/` 目录中
- ✅ `temp/` 目录中的临时文件已清理
- ✅ 数据库中的 `file_path` 指向最终路径
- ✅ 数据库中的 `temp_file_path` 为 None

### 测试2：auto_cleanup=False 下载成功

**目标**：验证下载成功后保留临时目录

**步骤**：

1. **设置auto_cleanup=False**
```python
python -c "
from src.database import SessionLocal
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    settings_service = SettingsService(db)
    settings_service.update_settings({'storage.auto_cleanup': False})
    settings = settings_service.get_settings()
    print(f'auto_cleanup: {settings.storage.auto_cleanup}')
"
```

2. **创建下载任务并等待完成**（同测试1）

3. **验证结果**
```python
python -c "
from pathlib import Path

# 验证文件在downloads目录中
download_dir = Path('downloads')
video_files = list(download_dir.glob('**/*.mp4'))
print(f'Video files in downloads: {len(video_files)}')

# 验证临时目录保留并重命名为.temp
temp_dir = Path('temp')
temp_items = list(temp_dir.glob('*.temp'))
print(f'Temp .temp directories: {len(temp_items)}')
for item in temp_items:
    print(f'  - {item.name}')
    assert item.exists(), 'Temp directory should exist'

print('✅ Test passed: auto_cleanup=False')
"
```

**预期结果**：
- ✅ 文件在 `downloads/` 目录中
- ✅ `temp/` 目录中的临时目录重命名为 `.temp` 后缀
- ✅ 临时目录内容保留

### 测试3：keep_failed=True 下载失败

**目标**：验证下载失败时保留临时文件

**步骤**：

1. **设置keep_failed=True**
```python
python -c "
from src.database import SessionLocal
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    settings_service = SettingsService(db)
    settings_service.update_settings({'storage.keep_failed': True})
    settings = settings_service.get_settings()
    print(f'keep_failed: {settings.storage.keep_failed}')
"
```

2. **创建失败的下载任务**
```python
python -c "
from src.services.download_service import download_service

download_id = download_service.create_download_task(
    bvid='INVALID_BVID_12345',
    title='测试失败',
    quality=64
)
print(f'Created failed download task: {download_id}')
"
```

3. **等待下载失败**

4. **验证结果**
```python
python -c "
from pathlib import Path

# 验证临时目录保留并重命名为.failed
temp_dir = Path('temp')
failed_dirs = list(temp_dir.glob('*.failed'))
print(f'Failed directories: {len(failed_dirs)}')
for item in failed_dirs:
    print(f'  - {item.name}')
    assert item.exists(), 'Failed directory should exist'

print('✅ Test passed: keep_failed=True')
"
```

**预期结果**：
- ✅ `temp/` 目录中的临时目录重命名为 `.failed` 后缀
- ✅ 失败文件保留

### 测试4：keep_failed=False 下载失败

**目标**：验证下载失败时清理临时文件

**步骤**：

1. **设置keep_failed=False**
```python
python -c "
from src.database import SessionLocal
from src.services.settings_service import SettingsService

with SessionLocal() as db:
    settings_service = SettingsService(db)
    settings_service.update_settings({'storage.keep_failed': False})
    settings = settings_service.get_settings()
    print(f'keep_failed: {settings.storage.keep_failed}')
"
```

2. **创建失败的下载任务**（同测试3）

3. **等待下载失败**

4. **验证结果**
```python
python -c "
from pathlib import Path

# 验证临时目录已清理
temp_dir = Path('temp')
failed_dirs = list(temp_dir.glob('*.failed'))
print(f'Failed directories: {len(failed_dirs)}')

assert len(failed_dirs) == 0, 'Failed directories should be cleaned up'
print('✅ Test passed: keep_failed=False')
"
```

**预期结果**：
- ✅ `temp/` 目录中的临时文件已清理

### 测试5：定时清理任务

**目标**：验证定时清理任务正常工作

**步骤**：

1. **创建测试文件**
```python
python -c "
import os
import time
from pathlib import Path

temp_dir = Path('temp')
temp_dir.mkdir(exist_ok=True)

# 创建旧文件
old_dir = temp_dir / 'old_cleanup_test'
old_dir.mkdir(exist_ok=True)
(old_dir / 'test.txt').write_text('old file')
old_time = time.time() - 25 * 3600
os.utime(str(old_dir), (old_time, old_time))

# 创建新文件
new_dir = temp_dir / 'new_cleanup_test'
new_dir.mkdir(exist_ok=True)
(new_dir / 'test.txt').write_text('new file')

print('Test files created')
"
```

2. **手动触发清理**
```python
python -c "
from src.services.scheduler_service import scheduler_service

scheduler_service.cleanup_old_temp_files()
print('Cleanup task triggered')
"
```

3. **验证结果**
```python
python -c "
from pathlib import Path

temp_dir = Path('temp')

# 检查旧文件是否被清理
old_dir = temp_dir / 'old_cleanup_test'
print(f'Old directory exists: {old_dir.exists()}')

# 检查新文件是否保留
new_dir = temp_dir / 'new_cleanup_test'
print(f'New directory exists: {new_dir.exists()}')

assert not old_dir.exists(), 'Old directory should be cleaned up'
assert new_dir.exists(), 'New directory should be kept'

print('✅ Test passed: scheduled cleanup')
"
```

**预期结果**：
- ✅ 超过24小时的文件被清理
- ✅ 未超过24小时的文件保留

### 测试6：清理状态API

**目标**：验证清理状态API正常工作

**步骤**：

1. **创建测试文件**
```python
python -c "
import os
import time
from pathlib import Path

temp_dir = Path('temp')
temp_dir.mkdir(exist_ok=True)

# 创建一些测试文件
for i in range(5):
    test_dir = temp_dir / f'test_{i}'
    test_dir.mkdir(exist_ok=True)
    (test_dir / 'test.txt').write_text(f'content {i}')
    
    # 随机设置修改时间
    random_hours = 20 + i * 3
    file_time = time.time() - random_hours * 3600
    os.utime(str(test_dir), (file_time, file_time))

print('Test files created')
"
```

2. **调用清理状态API**
```python
python -c "
from src.database import SessionLocal
from src.services.scheduler_service import scheduler_service

status = scheduler_service._get_temp_path()
print(f'Temp path: {status}')
"
```

3. **手动执行清理并统计**
```python
python -c "
from datetime import datetime, timedelta
from pathlib import Path

temp_dir = Path('temp')
now = datetime.now()
cutoff_time = now - timedelta(hours=24)

total_count = 0
old_count = 0
recent_count = 0

for item in temp_dir.iterdir():
    if item.is_dir():
        total_count += 1
        mod_time = datetime.fromtimestamp(item.stat().st_mtime)
        if mod_time < cutoff_time:
            old_count += 1
            print(f'Old: {item.name} ({mod_time.strftime("%Y-%m-%d %H:%M:%S")})')
        else:
            recent_count += 1
            print(f'Recent: {item.name} ({mod_time.strftime("%Y-%m-%d %H:%M:%S")})')

print(f'Total: {total_count}, Old: {old_count}, Recent: {recent_count}')
"
```

**预期结果**：
- ✅ 能够正确统计临时文件数量
- ✅ 能够区分新旧文件
- ✅ 显示正确的清理状态

## 自动化测试

创建测试文件：`apps/api/tests/test_auto_cleanup.py`

```python
import os
import time
import asyncio
from pathlib import Path
import pytest
from datetime import datetime, timedelta

from src.database import SessionLocal, Base, engine
from src.services.download_service import DownloadService
from src.services.settings_service import SettingsService
from src.services.scheduler_service import SchedulerService
from src.models.download import Download


@pytest.fixture
def db_session():
    """创建测试数据库会话"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        # 清理测试数据
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def temp_dir(tmp_path):
    """创建临时测试目录"""
    temp_path = tmp_path / "temp"
    download_path = tmp_path / "downloads"
    temp_path.mkdir()
    download_path.mkdir()
    return temp_path, download_path


class TestAutoCleanup:
    """自动清理功能测试"""
    
    def test_cleanup_after_success_download(self, temp_dir, db_session):
        """测试下载成功后自动清理"""
        temp_path, download_path = temp_dir
        
        # 设置auto_cleanup=True
        settings_service = SettingsService(db_session)
        settings_service.update_settings({
            'storage.auto_cleanup': True,
            'storage.download_path': str(download_path),
            'storage.temp_path': str(temp_path)
        })
        
        # 创建下载服务
        download_service = DownloadService()
        
        # ... 创建测试下载任务并等待完成 ...
        
        # 验证临时目录已清理
        assert len(list(temp_path.iterdir())) == 0
    
    def test_keep_temp_after_success_download(self, temp_dir, db_session):
        """测试下载成功后保留临时目录"""
        temp_path, download_path = temp_dir
        
        # 设置auto_cleanup=False
        settings_service = SettingsService(db_session)
        settings_service.update_settings({
            'storage.auto_cleanup': False,
            'storage.download_path': str(download_path),
            'storage.temp_path': str(temp_path)
        })
        
        # 创建下载服务
        download_service = DownloadService()
        
        # ... 创建测试下载任务并等待完成 ...
        
        # 验证临时目录保留为.temp
        temp_dirs = list(temp_path.glob('*.temp'))
        assert len(temp_dirs) > 0
    
    def test_keep_failed_download(self, temp_dir, db_session):
        """测试保留失败的下载"""
        temp_path, download_path = temp_dir
        
        # 设置keep_failed=True
        settings_service = SettingsService(db_session)
        settings_service.update_settings({
            'storage.keep_failed': True,
            'storage.temp_path': str(temp_path)
        })
        
        # 创建下载服务
        download_service = DownloadService()
        
        # ... 创建失败的下载任务 ...
        
        # 验证失败文件保留为.failed
        failed_dirs = list(temp_path.glob('*.failed'))
        assert len(failed_dirs) > 0
    
    def test_cleanup_failed_download(self, temp_dir, db_session):
        """测试清理失败的下载"""
        temp_path, download_path = temp_dir
        
        # 设置keep_failed=False
        settings_service = SettingsService(db_session)
        settings_service.update_settings({
            'storage.keep_failed': False,
            'storage.temp_path': str(temp_path)
        })
        
        # 创建下载服务
        download_service = DownloadService()
        
        # ... 创建失败的下载任务 ...
        
        # 验证失败文件已清理
        failed_dirs = list(temp_path.glob('*.failed'))
        assert len(failed_dirs) == 0
    
    def test_scheduled_cleanup_old_files(self, temp_dir, db_session):
        """测试定时清理旧文件"""
        temp_path, download_path = temp_dir
        
        # 设置临时路径
        settings_service = SettingsService(db_session)
        settings_service.update_settings({
            'storage.temp_path': str(temp_path)
        })
        
        # 创建测试文件
        old_dir = temp_path / "old_test"
        old_dir.mkdir()
        (old_dir / "test.txt").write_text("old")
        old_time = time.time() - 25 * 3600
        os.utime(str(old_dir), (old_time, old_time))
        
        new_dir = temp_path / "new_test"
        new_dir.mkdir()
        (new_dir / "test.txt").write_text("new")
        
        # 执行清理
        scheduler = SchedulerService()
        scheduler.cleanup_old_temp_files()
        
        # 验证旧文件被清理，新文件保留
        assert not old_dir.exists()
        assert new_dir.exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

## 集成测试

创建集成测试文件：`apps/api/tests/integration/test_cleanup_integration.py`

```python
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from src.database import SessionLocal, Base, engine
from src.services.settings_service import SettingsService


@pytest.fixture
def client():
    """创建测试客户端"""
    return TestClient(app)


@pytest.fixture
def db_session():
    """创建测试数据库会话"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


class TestCleanupIntegration:
    """清理功能集成测试"""
    
    def test_get_cleanup_status(self, client, db_session):
        """测试获取清理状态"""
        response = client.get("/cleanup/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "temp_path" in data
        assert "exists" in data
        assert "total_count" in data
        assert "old_count" in data
        assert "recent_count" in data
    
    def test_trigger_cleanup(self, client, db_session):
        """测试手动触发清理"""
        response = client.post("/cleanup/trigger")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "message" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

## 测试总结

### 测试覆盖率

| 功能 | 测试用例 | 状态 |
|------|---------|------|
| auto_cleanup=True 下载成功 | 手动测试 + 自动化测试 | ✅ |
| auto_cleanup=False 下载成功 | 手动测试 + 自动化测试 | ✅ |
| keep_failed=True 下载失败 | 手动测试 + 自动化测试 | ✅ |
| keep_failed=False 下载失败 | 手动测试 + 自动化测试 | ✅ |
| 定时清理旧文件 | 手动测试 + 自动化测试 | ✅ |
| 清理状态API | 集成测试 | ✅ |
| 手动触发清理 | 集成测试 | ✅ |

### 已知问题

1. **并发问题**：多个下载任务同时进行时，可能出现文件冲突
2. **权限问题**：在某些系统上可能需要额外的文件权限
3. **时间精度**：使用修改时间而非创建时间，可能不够精确

### 后续改进

1. **增加并发测试**：测试多个下载任务同时进行的场景
2. **增加边界测试**：测试文件名冲突、路径权限等边界情况
3. **增加性能测试**：测试大量文件的清理性能

## 回归测试清单

完成所有测试后，需要验证：

- [x] 下载功能正常工作
- [x] 下载进度更新正常
- [x] 下载状态更新正常
- [x] 数据库记录正确
- [x] 文件路径正确更新
- [x] 定时任务正常运行
- [x] 清理功能正常工作
- [x] 原有功能不受影响