from fastapi import APIRouter
from src.metrics.auth_metrics import AuthMetrics

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])

@router.get("/auth", response_model=dict)
async def get_auth_metrics():
    """获取认证相关的统计指标"""
    return {
        "success": True,
        "data": AuthMetrics.to_dict()
    }
