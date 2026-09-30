from src.services import subtitle_utils


def test_candidates_prefer_user_subtitles_and_keep_requested_order():
    subtitles = [
        {"lan": "en-US", "subtitle_url": "//example.test/en", "is_lock": False},
        {"lan": "ai-zh", "subtitle_url": "//aisubtitle.hdslb.com/zh"},
        {"lan": "zh-CN", "subtitle_url": "//example.test/zh", "is_lock": False},
    ]

    candidates = subtitle_utils.get_subtitle_candidates(subtitles, ["zh", "en"])

    assert [(item["language"], item["source"]) for item in candidates] == [
        ("zh-CN", "user"),
        ("en-US", "user"),
    ]


def test_srt_converters_format_payloads_and_preserve_invalid_json3():
    assert subtitle_utils.convert_bilibili_subtitle_to_srt(
        {"body": [{"from": 0, "to": 1.25, "content": "  hello  "}]}
    ) == "1\n00:00:00,000 --> 00:00:01,250\nhello\n"
    assert subtitle_utils.convert_json3_to_srt(
        '{"body": [{"from": 1250, "to": 2500, "content": "hi"}]}'
    ) == "1\n00:00:01,250 --> 00:00:02,500\nhi\n"
    assert subtitle_utils.convert_json3_to_srt("not json") == "not json"
