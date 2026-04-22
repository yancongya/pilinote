import asyncio

import pytest

from src.routers.favorites import build_favorite_video_cards


def test_build_favorite_video_cards_lazy_mode_skips_detail_enrichment():
    calls = []

    class FakeCacheService:
        async def get_video_info(self, bvid: str, sessdata: str = ""):
            calls.append((bvid, sessdata))
            return {"success": True, "data": {"stat": {}}}

    medias = [
        {
            "id": 1,
            "bvid": "BV1xxx",
            "title": "A",
            "cover": "cover-a.jpg",
            "duration": 120,
            "pubtime": 100,
            "fav_time": 200,
            "upper": {"mid": 10, "name": "u1", "face": "f1"},
            "cnt_info": {"play": 1, "danmaku": 2, "collect": 3},
        }
    ]

    cards = asyncio.run(
        build_favorite_video_cards(
            medias,
            sessdata="sessdata",
            enrich=False,
            cache_service=FakeCacheService(),
        )
    )

    assert len(cards) == 1
    assert cards[0]["comment"] == 0
    assert cards[0]["share"] == 0
    assert calls == []
