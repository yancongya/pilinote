"""
并发控制API路由 - 管理和监控系统并发状态
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging

from src.services.concurrency_control import (
    concurrency_control,
    ResourceType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/concurrency", tags=["concurrency"])


class ConcurrencyStatsResponse(BaseModel):
    """并发统计响应"""
    resource_type: str
    active_tasks: int
    available_slots: int
    max_concurrent: int
    total_requests: int
    successful_requests: int
    failed_requests: int
    rejected_requests: int
    avg_wait_time: float
    last_updated: Optional[str]


class ResourceUsageResponse(BaseModel):
    """资源使用响应"""
    cpu: Dict[str, Any]
    memory: Dict[str, Any]
    disk: Dict[str, Any]
    timestamp: str


class UpdateConcurrencyRequest(BaseModel):
    """更新并发数请求"""
    resource_type: str = Field(..., description="资源类型")
    max_concurrent: int = Field(..., ge=1, le=10, description="最大并发数")


class DynamicAdjustmentRequest(BaseModel):
    """动态调整请求"""
    enabled: bool = Field(..., description="是否启用动态调整")


@router.get("/stats", response_model=Dict[str, ConcurrencyStatsResponse])
async def get_concurrency_stats():
    """
    获取并发统计信息
    
    返回所有资源类型的并发统计信息
    """
    try:
        stats = concurrency_control.get_stats()
        
        response = {}
        for resource_type_name, resource_stats in stats.items():
            response[resource_type_name] = ConcurrencyStatsResponse(
                resource_type=resource_type_name,
                active_tasks=resource_stats['active_tasks'],
                available_slots=resource_stats['available_slots'],
                max_concurrent=concurrency_control.limits[ResourceType(resource_type_name)].max_concurrent,
                total_requests=resource_stats['stats']['total_requests'],
                successful_requests=resource_stats['stats']['successful_requests'],
                failed_requests=resource_stats['stats']['failed_requests'],
                rejected_requests=resource_stats['stats']['rejected_requests'],
                avg_wait_time=resource_stats['stats']['avg_wait_time'],
                last_updated=resource_stats['stats']['last_updated']
            )
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting concurrency stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{resource_type}", response_model=ConcurrencyStatsResponse)
async def get_concurrency_stats_by_type(resource_type: str):
    """
    获取特定资源类型的并发统计信息
    
    Args:
        resource_type: 资源类型 (video_download/page_download/api_request/media_processing)
    """
    try:
        # 验证资源类型
        try:
            rt = ResourceType(resource_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resource type: {resource_type}. Valid types: {[rt.value for rt in ResourceType]}"
            )
        
        stats = concurrency_control.get_stats(rt)
        
        return ConcurrencyStatsResponse(
            resource_type=resource_type,
            active_tasks=stats['active_tasks'],
            available_slots=stats['available_slots'],
            max_concurrent=concurrency_control.limits[rt].max_concurrent,
            total_requests=stats['stats']['total_requests'],
            successful_requests=stats['stats']['successful_requests'],
            failed_requests=stats['stats']['failed_requests'],
            rejected_requests=stats['stats']['rejected_requests'],
            avg_wait_time=stats['stats']['avg_wait_time'],
            last_updated=stats['stats']['last_updated']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting concurrency stats for {resource_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resource-usage", response_model=ResourceUsageResponse)
async def get_resource_usage():
    """
    获取系统资源使用情况
    
    返回CPU、内存、磁盘的使用情况
    """
    try:
        usage = concurrency_control.get_resource_usage()
        
        return ResourceUsageResponse(
            cpu=usage.get('cpu', {}),
            memory=usage.get('memory', {}),
            disk=usage.get('disk', {}),
            timestamp=usage.get('timestamp', '')
        )
        
    except Exception as e:
        logger.error(f"Error getting resource usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-max-concurrent")
async def update_max_concurrent(request: UpdateConcurrencyRequest):
    """
    更新最大并发数
    
    Args:
        request: 更新请求，包含资源类型和新的最大并发数
    """
    try:
        # 验证资源类型
        try:
            rt = ResourceType(request.resource_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resource type: {request.resource_type}. Valid types: {[rt.value for rt in ResourceType]}"
            )
        
        # 更新最大并发数
        concurrency_control.set_max_concurrent(rt, request.max_concurrent)
        
        logger.info(f"✓ Updated max concurrent for {request.resource_type}: {request.max_concurrent}")
        
        return {
            "success": True,
            "message": f"Max concurrent for {request.resource_type} updated to {request.max_concurrent}",
            "resource_type": request.resource_type,
            "max_concurrent": request.max_concurrent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating max concurrent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dynamic-adjustment")
async def set_dynamic_adjustment(request: DynamicAdjustmentRequest):
    """
    启用或禁用动态调整
    
    Args:
        request: 动态调整请求，包含是否启用
    """
    try:
        concurrency_control.set_dynamic_adjustment(request.enabled)
        
        logger.info(f"✓ Dynamic adjustment {'enabled' if request.enabled else 'disabled'}")
        
        return {
            "success": True,
            "message": f"Dynamic adjustment {'enabled' if request.enabled else 'disabled'}",
            "enabled": request.enabled
        }
        
    except Exception as e:
        logger.error(f"Error setting dynamic adjustment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_concurrency_config():
    """
    获取并发配置
    
    返回所有资源类型的并发配置
    """
    try:
        config = {}
        
        for resource_type, limit in concurrency_control.limits.items():
            config[resource_type.value] = {
                "max_concurrent": limit.max_concurrent,
                "cpu_threshold": limit.cpu_threshold,
                "memory_threshold": limit.memory_threshold,
                "disk_io_threshold": limit.disk_io_threshold
            }
        
        return {
            "dynamic_adjustment_enabled": concurrency_control.dynamic_adjustment_enabled,
            "resource_check_interval": concurrency_control.resource_check_interval,
            "limits": config
        }
        
    except Exception as e:
        logger.error(f"Error getting concurrency config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def concurrency_health():
    """
    并发控制健康检查
    
    返回并发控制服务的状态
    """
    try:
        return {
            "status": "healthy" if concurrency_control._running else "stopped",
            "running": concurrency_control._running,
            "dynamic_adjustment_enabled": concurrency_control.dynamic_adjustment_enabled,
            "active_services": {
                rt.value: {
                    "active": concurrency_control.get_active_count(rt),
                    "available": concurrency_control.get_available_count(rt)
                }
                for rt in ResourceType
            }
        }
        
    except Exception as e:
        logger.error(f"Error checking concurrency health: {e}")
        raise HTTPException(status_code=500, detail=str(e))