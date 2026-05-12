from pathlib import Path
import re

from fastapi import APIRouter, Depends, HTTPException, Query
import logging

from src.dependencies.auth import get_current_user_with_sessdata
from src.routers.favorites import build_favorite_video_cards
from src.schemas.scheduler import SchedulerCreate
from src.schemas.task import TaskCreate
from src.services.bilibili import BilibiliService
from src.services.cache.video_cache import VideoCacheService
from src.services.queue.manager import queue_manager
from src.services.settings_service import SettingsService
from src.database import SessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["订阅"])


def _sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename).strip()
    return cleaned or "未命名订阅"


def _normalize_subscription_source(folder: dict) -> dict:
    upper = folder.get("upper") or folder.get("owner") or {}
    source_id = folder.get("id") or folder.get("fid") or folder.get("media_id")
    raw_type = folder.get("type")
    source_type = "ugc_season" if raw_type == 21 else "favorite_folder"
    return {
        "id": f"{source_type}:{source_id}",
        "type": source_type,
        "source_id": str(source_id or ""),
        "title": folder.get("title") or folder.get("name") or "未命名收藏夹",
        "cover": folder.get("cover") or folder.get("pic") or "",
        "media_count": folder.get("media_count") or folder.get("count") or 0,
        "raw_type": raw_type,
        "link": folder.get("link") or "",
        "bvid": folder.get("bvid") or "",
        "upper": {
            "mid": upper.get("mid") or folder.get("mid") or 0,
            "name": upper.get("name") or folder.get("upper_name") or "",
            "face": upper.get("face") or "",
        },
        "updated_at": folder.get("mtime") or folder.get("fav_time") or 0,
    }


@router.get("/sources", response_model=dict)
async def get_subscription_sources(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    type: str = Query("all", description="all | favorite_folder | ugc_season"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
):
    """获取订阅源列表。

    复用 B 站“我的订阅”接口，统一返回订阅收藏夹和订阅合集/系列。
    """
    user, sessdata = user_sessdata
    sources: list[dict] = []
    warnings: list[str] = []

    if type in {"all", "favorite_folder", "ugc_season"}:
        service = BilibiliService()
        try:
            result = await service.get_collected_folders(
                sessdata,
                user.mid,
                page=page,
                page_size=page_size,
            )
            if result.get("success"):
                raw_list = (result.get("data") or {}).get("list") or []
                sources.extend(_normalize_subscription_source(item) for item in raw_list)
            else:
                warnings.append(result.get("message", "获取订阅收藏夹失败"))
        finally:
            service.close()

    if type != "all":
        sources = [source for source in sources if source.get("type") == type]

    if keyword:
        lowered = keyword.lower()
        sources = [source for source in sources if lowered in source.get("title", "").lower()]

    return {
        "success": True,
        "data": {
            "sources": sources,
            "page": page,
            "page_size": page_size,
            "total": len(sources),
            "partial": bool(warnings),
            "warnings": warnings,
        },
        "total": len(sources),
        "message": warnings[0] if sources == [] and warnings else None,
    }


@router.get("/sources/{source_type}/{source_id}/videos", response_model=dict)
async def get_subscription_source_videos(
    source_type: str,
    source_id: str,
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query("default", description="排序方式"),
    sort_direction: str = Query("desc", description="排序方向"),
):
    """获取订阅源下的视频列表。"""
    user, sessdata = user_sessdata

    if source_type not in {"favorite_folder", "ugc_season"}:
        raise HTTPException(status_code=400, detail="不支持的订阅源类型")

    try:
        folder_id = int(source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="无效的订阅收藏夹 ID") from exc

    service = BilibiliService()
    cache_service = VideoCacheService()
    try:
        if source_type == "ugc_season":
            result = await service.get_subscription_season_detail(
                sessdata,
                folder_id,
                page=page,
                page_size=page_size,
            )
            failure_message = "获取订阅合集视频失败"
        else:
            result = await service.get_folder_detail(
                sessdata,
                folder_id,
                page=page,
                page_size=page_size,
                keyword=keyword,
                order="mtime" if order == "default" else order,
                sort_direction=sort_direction,
            )
            failure_message = "获取订阅收藏夹视频失败"

        if not result.get("success"):
            raise HTTPException(status_code=502, detail=result.get("message", failure_message))

        data = result.get("data") or {}
        medias = data.get("medias") or []
        info = data.get("info") or {}
        if keyword:
            lowered = keyword.lower()
            medias = [media for media in medias if lowered in (media.get("title") or "").lower()]
        list_data = await build_favorite_video_cards(
            medias,
            sessdata,
            enrich=False,
            cache_service=cache_service,
        )

        for item in list_data:
            item["source_type"] = "subscription"
            item["subscription_type"] = source_type
            item["subscription_id"] = str(folder_id)
            item["subscription_title"] = info.get("title") or ""

        return {
            "success": True,
            "data": {
                "info": {
                    **info,
                    "id": str(folder_id),
                    "type": source_type,
                },
                "medias": list_data,
                "page": page,
                "page_size": page_size,
            },
            "total": info.get("media_count", 0),
        }
    finally:
        service.close()


@router.get("/sources/{source_type}/{source_id}/status", response_model=dict)
async def get_subscription_source_status(
    source_type: str,
    source_id: str,
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
):
    """获取订阅源的下载状态。

    返回状态类型：
    - not_added: 本地没有任何该合集任务
    - partial: 部分视频在队列或已下载 (X/Y)
    - has_update: 合集新增了 N 个视频
    - complete: 当前合集所有视频都已在本地或队列中
    """
    user, sessdata = user_sessdata

    if source_type not in {"favorite_folder", "ugc_season"}:
        raise HTTPException(status_code=400, detail="不支持的订阅源类型")

    try:
        numeric_source_id = int(source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="无效的订阅源 ID") from exc

    service = BilibiliService()
    try:
        # 获取订阅源详情
        if source_type == "ugc_season":
            detail_result = await service.get_subscription_season_detail(
                sessdata,
                numeric_source_id,
                page=1,
                page_size=100,
            )
        else:
            detail_result = await service.get_folder_detail(
                sessdata,
                numeric_source_id,
                page=1,
                page_size=100,
                order="mtime",
            )

        if not detail_result.get("success"):
            raise HTTPException(status_code=502, detail=detail_result.get("message", "获取订阅源详情失败"))

        data = detail_result.get("data") or {}
        info = data.get("info") or {}
        medias = data.get("medias") or []
        if not isinstance(medias, list):
            medias = []

        # 获取所有 BVID
        all_bvids = {media.get("bvid") for media in medias if media.get("bvid")}
        total_count = len(all_bvids)

        # 查找已存在的任务
        existing_tasks = [
            task for task in queue_manager.tasks.values()
            if task.media_type == "video"
            and task.media_id
            and str((task.meta or {}).get("subscription_type") or "") == source_type
            and str((task.meta or {}).get("subscription_id") or "") == str(source_id)
            and str(task.state) not in {"6", "TaskState.CANCELLED", "cancelled"}
        ]

        existing_bvids = {task.media_id for task in existing_tasks}
        existing_count = len(existing_bvids & all_bvids)

        # 计算新增视频
        new_bvids = all_bvids - existing_bvids
        new_count = len(new_bvids)

        # 判断状态
        if existing_count == 0:
            status_type = "not_added"
            status_text = "添加系列"
        elif existing_count == total_count:
            status_type = "complete"
            status_text = "已完整"
        elif new_count > 0:
            status_type = "has_update"
            status_text = f"有更新 +{new_count}"
        else:
            status_type = "partial"
            status_text = f"已添加 {existing_count}/{total_count}"

        return {
            "success": True,
            "data": {
                "source_type": source_type,
                "source_id": str(source_id),
                "status_type": status_type,
                "status_text": status_text,
                "total_count": total_count,
                "existing_count": existing_count,
                "new_count": new_count,
                "title": info.get("title") or f"订阅源 {source_id}",
            },
        }
    finally:
        service.close()


@router.post("/sources/{source_type}/{source_id}/queue", response_model=dict)
async def add_subscription_source_to_queue(
    source_type: str,
    source_id: str,
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
):
    """将订阅源作为系列加入下载队列。

    每次点击都会重新拉取订阅源详情，只把当前队列里尚不存在的 BVID 加入队列。
    支持增量更新：只添加新增的视频，已存在的视频会被跳过。
    """
    user, sessdata = user_sessdata

    if source_type not in {"favorite_folder", "ugc_season"}:
        raise HTTPException(status_code=400, detail="不支持的订阅源类型")

    try:
        numeric_source_id = int(source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="无效的订阅源 ID") from exc

    service = BilibiliService()
    try:
        if source_type == "ugc_season":
            detail_result = await service.get_subscription_season_detail(
                sessdata,
                numeric_source_id,
                page=1,
                page_size=100,
            )
            failure_message = "获取订阅合集视频失败"
        else:
            detail_result = await service.get_folder_detail(
                sessdata,
                numeric_source_id,
                page=1,
                page_size=100,
                order="mtime",
            )
            failure_message = "获取订阅收藏夹视频失败"

        if not detail_result.get("success"):
            raise HTTPException(status_code=502, detail=detail_result.get("message", failure_message))

        data = detail_result.get("data") or {}
        info = data.get("info") or {}
        medias = data.get("medias") or []
        if not isinstance(medias, list):
            medias = []

        source_title = info.get("title") or f"订阅源 {source_id}"
        current_bvids = [media.get("bvid") for media in medias if media.get("bvid")]
        
        # 查找已存在的任务（包括队列中和已完成的）
        existing_tasks = {
            task.media_id: task
            for task in queue_manager.tasks.values()
            if task.media_type == "video"
            and task.media_id
            and str((task.meta or {}).get("subscription_type") or "") == source_type
            and str((task.meta or {}).get("subscription_id") or "") == str(source_id)
            and str(task.state) not in {"6", "TaskState.CANCELLED", "cancelled"}
        }

        existing_bvids = set(existing_tasks.keys())
        task_ids: list[str] = []
        skipped_existing = 0
        invalid_count = 0

        # 保存系列快照信息到 meta
        snapshot_meta = {
            "subscription_type": source_type,
            "subscription_id": str(source_id),
            "subscription_title": source_title,
            "subscription_total": info.get("media_count") or len(medias),
            "subscription_snapshot_at": int(__import__("time").time()),
            "subscription_bvids": current_bvids,  # 保存当前所有 BVID
            "source_updated_at": info.get("mtime") or info.get("pubtime") or 0,
        }

        for index, media in enumerate(medias, start=1):
            bvid = media.get("bvid")
            if not bvid:
                invalid_count += 1
                continue
            if bvid in existing_bvids:
                skipped_existing += 1
                # 更新已存在任务的快照信息
                existing_task = existing_tasks[bvid]
                existing_meta = existing_task.meta or {}
                existing_meta.update({
                    "subscription_snapshot_at": snapshot_meta["subscription_snapshot_at"],
                    "subscription_total": snapshot_meta["subscription_total"],
                    "source_updated_at": snapshot_meta["source_updated_at"],
                })
                continue

            title = media.get("title") or f"{source_title} P{index}"
            cover = media.get("cover") or media.get("pic") or info.get("cover") or ""
            upper = media.get("upper") or info.get("upper") or {}
            
            meta = {
                **snapshot_meta,
                "page": index,
                "part_title": title,
                "series_title": source_title,
                "collection_title": source_title,
                "collection_episode_title": title,
                "source_upper": upper,
                "pic": cover,
                "output_subdir": f"P{str(index).zfill(2)} - {title}",
            }

            task_response = await queue_manager.submit_backlog(TaskCreate(
                media_type="video",
                media_id=bvid,
                title=title,
                cover=cover,
                desc=f"订阅源: {source_title}",
                meta=meta,
            ))

            if task_response.id not in task_ids:
                task_ids.append(task_response.id)
            existing_bvids.add(bvid)

        scheduler_id = None
        if task_ids:
            db = SessionLocal()
            try:
                settings = SettingsService(db).get_settings()
                download_path = settings.storage.download_path or "./downloads"
            finally:
                db.close()

            folder = str(Path(download_path) / f"系列-{_sanitize_filename(source_title)}")
            scheduler = await queue_manager.plan_scheduler(SchedulerCreate(
                title=source_title,
                task_ids=task_ids,
                folder=folder,
            ))
            scheduler_id = scheduler.id

        return {
            "success": True,
            "message": f"已添加 {len(task_ids)} 个新视频" if task_ids else "没有新的可添加视频",
            "data": {
                "source_type": source_type,
                "source_id": str(source_id),
                "title": source_title,
                "media_count": info.get("media_count") or len(medias),
                "added_count": len(task_ids),
                "skipped_existing": skipped_existing,
                "invalid_count": invalid_count,
                "task_ids": task_ids,
                "scheduler_id": scheduler_id,
                "snapshot": snapshot_meta,
            },
        }
    finally:
        service.close()
