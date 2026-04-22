from fastapi import APIRouter, HTTPException, Query, Depends
from src.services.bilibili import BilibiliService
from src.schemas.card import CardData, CardListResponse
from src.dependencies.auth import get_current_user_with_sessdata
from src.services.cache.video_cache import video_cache

router = APIRouter(prefix="/api/watch-later", tags=["稍后再看"])


def _build_watch_later_response(
    raw_data: dict,
    pn: int,
    ps: int,
    keyword: str,
    order: str,
    sort_direction: str,
) -> CardListResponse:
    from src.services.media_data_transformer import transformer

    video_list = transformer.transform_watchlater_list(raw_data)

    keyword_str = str(keyword) if keyword else ""
    if keyword_str:
        video_list = [
            video
            for video in video_list
            if keyword_str.lower() in (video.title or "").lower()
        ]

    reverse = sort_direction == "desc"

    if order == "view":
        video_list = sorted(video_list, key=lambda x: x.view or 0, reverse=reverse)
    elif order == "pubtime":
        video_list = sorted(video_list, key=lambda x: x.pubtime or 0, reverse=reverse)
    elif order == "add_time":
        video_list = sorted(video_list, key=lambda x: x.add_time or 0, reverse=reverse)

    start_idx = (pn - 1) * ps
    end_idx = start_idx + ps
    paginated_list = video_list[start_idx:end_idx]
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


@router.get("/list", response_model=CardListResponse)
async def get_watch_later_list(
    user_sessdata: tuple = Depends(get_current_user_with_sessdata),
    pn: int = Query(1, ge=1, description="页码"),
    ps: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: str = Query("", description="搜索关键词"),
    order: str = Query(
        "default", description="排序方式: default, view, pubtime, add_time"
    ),
    sort_direction: str = Query("desc", description="排序方向: desc, asc"),
):
    """获取稍后再看列表（支持分页、搜索、排序）

    功能：
    - 支持分页
    - 支持关键词搜索
    - 支持排序（按播放量、发布时间、添加时间）
    - 支持升序/降序切换
    - 使用B站原生API快速加载
    """
    user, sessdata = user_sessdata
    cache_key = user.mid

    try:
        service = BilibiliService()
        try:
            result = await service.get_watch_later(sessdata, cache_key=str(user.mid))
            if result["success"]:
                return _build_watch_later_response(result["data"], pn, ps, keyword, order, sort_direction)

            cached = video_cache.get("watch_later", user_id=cache_key)
            if cached and cached.get("success") and cached.get("data") is not None:
                return _build_watch_later_response(cached["data"], pn, ps, keyword, order, sort_direction)

            raise HTTPException(
                status_code=400,
                detail=result.get("message", "获取稍后再看列表失败"),
            )
        finally:
            service.close()
    except Exception as e:
        cached = video_cache.get("watch_later", user_id=cache_key)
        if cached and cached.get("success") and cached.get("data") is not None:
            return _build_watch_later_response(cached["data"], pn, ps, keyword, order, sort_direction)
        raise HTTPException(status_code=500, detail=f"获取稍后再看列表失败: {str(e)}")
