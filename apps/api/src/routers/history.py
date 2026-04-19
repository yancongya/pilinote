from fastapi import APIRouter, HTTPException, Query, Depends
from src.services.bilibili import BilibiliService
from src.schemas.card import CardData, CardListResponse
from src.dependencies.auth import get_current_user_with_sessdata

router = APIRouter(prefix="/api/history", tags=["观看历史"])


@router.get("/list", response_model=CardListResponse)
async def get_history_list(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query(
        "default", description="排序方式: default, view, pubtime, view_at"
    ),
    sort_direction: str = Query("desc", description="排序方向: desc, asc"),
):
    """获取观看历史列表（支持分页、搜索、排序）

    功能：
    - 支持分页
    - 支持关键词搜索
    - 支持排序（按播放量、发布时间、观看时间）
    - 支持升序/降序切换
    - 使用B站原生API快速加载
    """
    user, sessdata = user_sessdata

    try:
        import traceback

        service = BilibiliService()
        try:
            result = await service.get_history(sessdata)
            if result["success"]:
                from src.services.media_data_transformer import transformer

                data = result["data"]

                # 使用统一转换器转换数据
                video_list = transformer.transform_history_list(data)

                # 搜索过滤
                keyword_str = str(keyword) if keyword else ""
                if keyword_str:
                    video_list = [
                        video
                        for video in video_list
                        if keyword_str.lower() in (video.title or "").lower()
                    ]

                # 排序
                reverse = sort_direction == "desc"

                if order == "view":
                    video_list = sorted(
                        video_list, key=lambda x: x.view or 0, reverse=reverse
                    )
                elif order == "pubtime":
                    video_list = sorted(
                        video_list, key=lambda x: x.pubtime or 0, reverse=reverse
                    )
                elif order == "view_at":
                    video_list = sorted(
                        video_list, key=lambda x: x.add_time or 0, reverse=reverse
                    )

                # 分页处理
                start_idx = (pn - 1) * ps
                end_idx = start_idx + ps
                paginated_list = video_list[start_idx:end_idx]

                # 转换为字典格式（保持向后兼容）
                list_data = [card.model_dump() for card in paginated_list]

                return CardListResponse(
                    success=True,
                    data={
                        "list": list_data,
                        "total": len(video_list),
                        "page": pn,
                        "page_size": ps,
                    },
                    total=len(video_list),
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=result.get("message", "获取观看历史列表失败"),
                )
        finally:
            service.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取观看历史列表失败: {str(e)}")
