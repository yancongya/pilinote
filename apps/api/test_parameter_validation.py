#!/usr/bin/env python3
"""
参数验证测试脚本
测试任务创建和调度器创建的参数验证功能
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from pydantic import ValidationError
from src.schemas.task import TaskCreate, MediaType
from src.schemas.scheduler import SchedulerCreate


def test_task_create_validation():
    """测试任务创建的参数验证"""
    print("=== 测试任务创建参数验证 ===\n")

    # 测试1: 正常任务创建应该成功
    print("测试1: 正常任务创建")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1xx411c7mD",
            title="测试视频",
            meta={"cid": 123456, "page": 1}
        )
        print(f"✓ 成功创建任务: media_type={task.media_type}, media_id={task.media_id}\n")
    except ValidationError as e:
        print(f"✗ 失败: {e}\n")

    # 测试2: media_id为空应该失败
    print("测试2: media_id为空")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="",
            title="测试视频"
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试3: media_id超过长度限制应该失败
    print("测试3: media_id超过50字符限制")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="A" * 51,
            title="测试视频"
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试4: title超过长度限制应该失败
    print("测试4: title超过200字符限制")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1xx411c7mD",
            title="A" * 201
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试5: cover超过长度限制应该失败
    print("测试5: cover超过500字符限制")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1xx411c7mD",
            cover="A" * 501
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试6: desc超过长度限制应该失败
    print("测试6: desc超过2000字符限制")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1xx411c7mD",
            desc="A" * 2001
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试7: 缺少media_id应该失败
    print("测试7: 缺少media_id字段")
    try:
        task = TaskCreate(
            media_type=MediaType.VIDEO,
            title="测试视频"
        )
        print(f"✗ 应该失败但成功了: {task}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试8: 测试所有有效的media_type
    print("测试8: 测试所有有效的media_type枚举值")
    valid_types = [
        "video", "bangumi", "music", "music_list", "lesson",
        "watch_later", "favorite", "opus", "opus_list",
        "user_video", "user_opus", "user_audio"
    ]
    for media_type in valid_types:
        try:
            task = TaskCreate(
                media_type=media_type,
                media_id="BV1xx411c7mD"
            )
            print(f"  ✓ {media_type}: 成功")
        except ValidationError as e:
            print(f"  ✗ {media_type}: 失败 - {e.errors()[0]['msg']}")
    print()


def test_scheduler_create_validation():
    """测试调度器创建的参数验证"""
    print("=== 测试调度器创建参数验证 ===\n")

    # 测试1: 正常调度器创建应该成功
    print("测试1: 正常调度器创建")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            folder="/path/to/folder"
        )
        print(f"✓ 成功创建调度器: title={scheduler.title}, folder={scheduler.folder}\n")
    except ValidationError as e:
        print(f"✗ 失败: {e}\n")

    # 测试2: title为空应该失败
    print("测试2: title为空")
    try:
        scheduler = SchedulerCreate(
            title="",
            folder="/path/to/folder"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试3: title超过长度限制应该失败
    print("测试3: title超过200字符限制")
    try:
        scheduler = SchedulerCreate(
            title="A" * 201,
            folder="/path/to/folder"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试4: folder为空应该失败
    print("测试4: folder为空")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            folder=""
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试5: folder超过长度限制应该失败
    print("测试5: folder超过500字符限制")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            folder="A" * 501
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试6: task_ids为空列表应该失败
    print("测试6: task_ids为空列表")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            task_ids=[],
            folder="/path/to/folder"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试7: task_ids包含无效UUID格式应该失败
    print("测试7: task_ids包含无效UUID格式")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            task_ids=["invalid-uuid-format"],
            folder="/path/to/folder"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试8: task_ids包含有效UUID应该成功
    print("测试8: task_ids包含有效UUID格式")
    try:
        scheduler = SchedulerCreate(
            title="测试系列",
            task_ids=["550e8400-e29b-41d4-a716-446655440000"],
            folder="/path/to/folder"
        )
        print(f"✓ 成功创建调度器: task_ids={scheduler.task_ids}\n")
    except ValidationError as e:
        print(f"✗ 失败: {e.errors()[0]['msg']}\n")

    # 测试9: 缺少title应该失败
    print("测试9: 缺少title字段")
    try:
        scheduler = SchedulerCreate(
            folder="/path/to/folder"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")

    # 测试10: 缺少folder应该失败
    print("测试10: 缺少folder字段")
    try:
        scheduler = SchedulerCreate(
            title="测试系列"
        )
        print(f"✗ 应该失败但成功了: {scheduler}\n")
    except ValidationError as e:
        print(f"✓ 成功捕获错误: {e.errors()[0]['msg']}\n")


if __name__ == "__main__":
    print("开始参数验证测试...\n")
    test_task_create_validation()
    test_scheduler_create_validation()
    print("所有测试完成!")