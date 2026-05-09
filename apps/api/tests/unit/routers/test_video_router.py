from src.routers.video import _normalize_ugc_season


def test_normalize_ugc_season_extracts_collection_episodes():
    normalized = _normalize_ugc_season({
        "id": 1,
        "title": "合集标题",
        "cover": "https://example.com/series.jpg",
        "sections": [
            {
                "title": "正片",
                "episodes": [
                    {
                        "bvid": "BV1",
                        "cid": 101,
                        "title": "第一集",
                        "arc": {"pic": "https://example.com/1.jpg", "duration": 12},
                    },
                    {
                        "bvid": "BV2",
                        "cid": 102,
                        "title": "第二集",
                        "cover": "https://example.com/2.jpg",
                    },
                ],
            }
        ],
    })

    assert normalized["title"] == "合集标题"
    assert normalized["episode_count"] == 2
    assert normalized["sections"][0]["episodes"][0] == {
        "bvid": "BV1",
        "cid": 101,
        "title": "第一集",
        "cover": "https://example.com/1.jpg",
        "page": 1,
        "index": 1,
        "duration": 12,
    }
