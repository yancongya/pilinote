from src.services.download_service import DownloadService
from src.services.queue.handlers.nfo import SingleNfoHandler


def test_download_service_rating_is_five_point_scale():
    service = DownloadService()
    rating = service._calculate_bilibili_rating(
        {
            "view": 10000,
            "like": 500,
            "coin": 200,
            "favorite": 100,
            "share": 50,
            "danmaku": 80,
            "reply": 60,
        }
    )

    assert 0 <= rating <= 5


def test_nfo_handler_rating_is_five_point_scale():
    handler = SingleNfoHandler()
    rating = handler._calculate_rating(
        {
            "view": 10000,
            "like": 500,
            "coin": 200,
            "favorite": 100,
            "share": 50,
            "danmaku": 80,
            "reply": 60,
        }
    )

    assert 0 <= rating <= 5
