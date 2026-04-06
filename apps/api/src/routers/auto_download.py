"""
Auto download router for scanning functionality
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from src.database import get_db
from src.schemas.auto_download import (
    ScanRecord,
    ScanTriggerRequest,
    ScanTriggerResponse
)
from src.services.scan_service import ScanService
from src.dependencies.auth import get_current_user_with_sessdata


router = APIRouter(prefix="/api/auto-download", tags=["自动下载"])


@router.get("/scan-records", response_model=dict)
async def get_scan_records(
    source_type: Optional[str] = Query(None, description="视频源类型 (favorite/watch_later)"),
    db: Session = Depends(get_db)
):
    """
    获取扫描记录列表
    
    Args:
        source_type: 可选的视频源类型过滤
        
    Returns:
        扫描记录列表
    """
    try:
        service = ScanService(db)
        records = await service.get_scan_records(source_type)
        
        return {
            "success": True,
            "data": [record.model_dump() for record in records]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取扫描记录失败: {str(e)}"
        )


@router.post("/scan/trigger", response_model=dict)
async def trigger_scan(
    source_type: str = Query(..., description="视频源类型 (favorite/watch_later)"),
    source_id: str = Query("all", description="视频源 ID，默认为 all"),
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    db: Session = Depends(get_db)
):
    """
    手动触发扫描
    
    Args:
        source_type: 视频源类型 (favorite/watch_later)
        source_id: 视频源 ID，默认为 all
        
    Returns:
        扫描结果
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user, sessdata = user_sessdata
        logger.info(f"[API Trigger Scan] User: {user.username}, MID: {user.mid}")
        logger.info(f"[API Trigger Scan] Source type: {source_type}, Source ID: {source_id}")
        logger.info(f"[API Trigger Scan] SESSDATA length: {len(sessdata) if sessdata else 0}")
        
        # 验证视频源类型
        if source_type not in ["favorite", "watch_later"]:
            raise HTTPException(
                status_code=400,
                detail="无效的视频源类型，必须是 favorite 或 watch_later"
            )
        
        service = ScanService(db)
        result = await service.trigger_scan(
            source_type=source_type,
            source_id=source_id,
            sessdata=sessdata,
            user_mid=user.mid
        )
        
        logger.info(f"[API Trigger Scan] Result: total={result.total}, new={result.new}, folders={result.folder_count}")
        
        return {
            "success": True,
            "data": result.model_dump()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API Trigger Scan] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"扫描失败: {str(e)}"
        )


@router.delete("/scan-records/{record_id}", response_model=dict)
async def delete_scan_record(
    record_id: str,
    db: Session = Depends(get_db)
):
    """
    删除单个扫描记录
    
    Args:
        record_id: 记录 ID
        
    Returns:
        删除结果
    """
    try:
        service = ScanService(db)
        success = await service.delete_scan_record(record_id)
        
        if success:
            return {
                "success": True,
                "message": "扫描记录已删除"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="删除扫描记录失败"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除扫描记录失败: {str(e)}"
        )


@router.delete("/scan-records", response_model=dict)
async def clear_scan_records(
    source_type: Optional[str] = Query(None, description="视频源类型 (favorite/watch_later)"),
    days: Optional[int] = Query(None, description="保留最近几天的记录，不传则删除所有"),
    db: Session = Depends(get_db)
):
    """
    清除扫描记录
    
    Args:
        source_type: 可选的视频源类型过滤
        days: 保留最近几天的记录，不传则删除所有
        
    Returns:
        清除结果
    """
    try:
        service = ScanService(db)
        deleted_count = await service.clear_scan_records(source_type, days)
        
        return {
            "success": True,
            "message": f"已清除 {deleted_count} 条扫描记录",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"清除扫描记录失败: {str(e)}"
        )