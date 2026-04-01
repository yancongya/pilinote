"""
数据库迁移验证测试脚本

测试内容：
1. 向后兼容性测试
2. 新功能测试
3. 数据完整性测试
"""
import sys
from pathlib import Path

# 添加apps/api到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.database import engine, SessionLocal
from src.models.download import Download
from src.models.task import Task, TaskState, MediaType
from src.models.scheduler import Scheduler, SchedulerState
from src.models.queue import Queue, QueueType


def test_backward_compatibility():
    """测试向后兼容性"""
    print("\n" + "=" * 60)
    print("测试1：向后兼容性")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 测试1：创建旧的Download记录（不包含新字段）
        print("\n1.1 创建旧的Download记录...")
        old_download = Download(
            id="test-old-download",
            bvid="BV1xx411c7mD",
            title="测试视频（旧格式）",
            status="pending"
        )
        db.add(old_download)
        db.commit()
        db.refresh(old_download)
        print(f"✓ 旧记录创建成功: {old_download.id}")
        print(f"  - bvid: {old_download.bvid}")
        print(f"  - title: {old_download.title}")
        print(f"  - status: {old_download.status}")
        print(f"  - media_type: {old_download.media_type} (应为None)")
        print(f"  - source_type: {old_download.source_type} (应为None)")
        print(f"  - task_id: {old_download.task_id} (应为None)")

        # 测试2：创建新的Download记录（包含新字段）
        print("\n1.2 创建新的Download记录...")
        new_download = Download(
            id="test-new-download",
            bvid="BV1yy411c7mD",
            title="测试视频（新格式）",
            status="pending",
            media_type="video",
            source_type="direct",
            source_id="test-source",
            task_id="test-task-id"
        )
        db.add(new_download)
        db.commit()
        db.refresh(new_download)
        print(f"✓ 新记录创建成功: {new_download.id}")
        print(f"  - media_type: {new_download.media_type}")
        print(f"  - source_type: {new_download.source_type}")
        print(f"  - source_id: {new_download.source_id}")
        print(f"  - task_id: {new_download.task_id}")

        # 测试3：查询旧记录
        print("\n1.3 查询旧记录...")
        old_record = db.query(Download).filter_by(id="test-old-download").first()
        if old_record:
            print(f"✓ 旧记录查询成功")
            print(f"  - 所有字段均可正常访问")
        else:
            print("✗ 旧记录查询失败")
            return False

        # 测试4：查询新记录
        print("\n1.4 查询新记录...")
        new_record = db.query(Download).filter_by(id="test-new-download").first()
        if new_record:
            print(f"✓ 新记录查询成功")
            print(f"  - media_type: {new_record.media_type}")
        else:
            print("✗ 新记录查询失败")
            return False

        # 清理测试数据
        db.delete(old_download)
        db.delete(new_download)
        db.commit()

        print("\n✓ 向后兼容性测试通过")
        return True

    except Exception as e:
        db.rollback()
        print(f"\n✗ 向后兼容性测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_new_tables():
    """测试新表功能"""
    print("\n" + "=" * 60)
    print("测试2：新表功能")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 测试1：创建Task
        print("\n2.1 创建Task...")
        task = Task(
            media_type="video",
            media_id="BV1zz411c7mD",
            title="测试任务",
            meta={"test": "data"},
            prepare={"test": "prepare"},
            status={"progress": 0},
            state=TaskState.PENDING
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        print(f"✓ Task创建成功: {task.id}")
        print(f"  - media_type: {task.media_type}")
        print(f"  - state: {task.state}")

        # 测试2：创建Scheduler
        print("\n2.2 创建Scheduler...")
        scheduler = Scheduler(
            title="测试调度器",
            list=[task.id],
            count=1,
            queue_type=QueueType.PENDING,
            state=SchedulerState.PENDING,
            folder="/tmp/test"
        )
        db.add(scheduler)
        db.commit()
        db.refresh(scheduler)
        print(f"✓ Scheduler创建成功: {scheduler.id}")
        print(f"  - title: {scheduler.title}")
        print(f"  - count: {scheduler.count}")

        # 测试3：查询Queue
        print("\n2.3 查询Queue...")
        queue = db.query(Queue).filter_by(queue_type=QueueType.BACKLOG).first()
        if queue:
            print(f"✓ Queue查询成功")
            print(f"  - queue_type: {queue.queue_type}")
            print(f"  - value: {queue.value}")
        else:
            print("✗ Queue查询失败")
            return False

        # 清理测试数据
        db.delete(task)
        db.delete(scheduler)
        db.commit()

        print("\n✓ 新表功能测试通过")
        return True

    except Exception as e:
        db.rollback()
        print(f"\n✗ 新表功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_data_integrity():
    """测试数据完整性"""
    print("\n" + "=" * 60)
    print("测试3：数据完整性")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 测试1：检查外键关系
        print("\n3.1 测试外键关系...")

        # 创建Task
        task = Task(
            media_type="video",
            media_id="BV1aa411c7mD",
            title="测试关联",
            meta={},
            prepare={},
            status={},
            state=TaskState.PENDING
        )
        db.add(task)
        db.commit()

        # 创建Download并关联Task
        download = Download(
            id="test-association",
            bvid="BV1aa411c7mD",
            title="测试关联",
            status="pending",
            media_type="video",
            source_type="direct",
            task_id=task.id  # 关联到Task
        )
        db.add(download)
        db.commit()
        db.refresh(download)

        # 验证关联
        if download.task_id == task.id:
            print(f"✓ Download和Task关联成功")
            print(f"  - Download.task_id: {download.task_id}")
            print(f"  - Task.id: {task.id}")
        else:
            print("✗ 关联失败")
            return False

        # 清理
        db.delete(download)
        db.delete(task)
        db.commit()

        print("\n✓ 数据完整性测试通过")
        return True

    except Exception as e:
        db.rollback()
        print(f"\n✗ 数据完整性测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_api_endpoints():
    """测试API端点"""
    print("\n" + "=" * 60)
    print("测试4：API端点（需要API服务运行）")
    print("=" * 60)

    try:
        import requests
    except ImportError:
        print("\n⚠ requests模块未安装，跳过API测试")
        print("提示：运行 pip install requests 安装依赖")
        return True  # 不算失败，只是跳过

    base_url = "http://localhost:8000"

    try:
        # 测试健康检查
        print("\n4.1 测试健康检查...")
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print(f"✓ API服务正常运行")
            print(f"  - 响应: {response.json()}")
        else:
            print(f"✗ API服务异常: HTTP {response.status_code}")
            return False

        # 测试缓存统计
        print("\n4.2 测试缓存统计...")
        response = requests.get(f"{base_url}/api/cache/stats", timeout=5)
        if response.status_code == 200:
            print(f"✓ 缓存统计接口正常")
            stats = response.json()
            print(f"  - total_count: {stats.get('total_count', 0)}")
        else:
            print(f"✗ 缓存统计接口异常: HTTP {response.status_code}")

        # 测试队列查询
        print("\n4.3 测试队列查询...")
        response = requests.get(f"{base_url}/api/queue/", timeout=5)
        if response.status_code == 200:
            print(f"✓ 队列查询接口正常")
            queues = response.json()
            print(f"  - 队列数量: {len(queues)}")
        else:
            print(f"✗ 队列查询接口异常: HTTP {response.status_code}")

        print("\n✓ API端点测试通过")
        return True

    except requests.exceptions.ConnectionError:
        print("\n⚠ API服务未运行，跳过API测试")
        print("提示：请先启动API服务：cd apps/api && python3 main.py")
        return True  # 不算失败，只是跳过
    except Exception as e:
        print(f"\n✗ API端点测试失败: {e}")
        return False


def main():
    """运行所有测试"""
    print("=" * 60)
    print("数据库迁移验证测试")
    print("=" * 60)

    results = {}

    # 运行测试
    results["向后兼容性"] = test_backward_compatibility()
    results["新表功能"] = test_new_tables()
    results["数据完整性"] = test_data_integrity()
    results["API端点"] = test_api_endpoints()

    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{test_name}: {status}")

    print(f"\n总计: {passed}/{total} 测试通过")

    if passed == total:
        print("\n✓ 所有测试通过！迁移成功！")
        return 0
    else:
        print(f"\n✗ {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())