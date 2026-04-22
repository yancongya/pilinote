from src.services.ai.subtitle_analyzer import (
    SubtitleAnalyzer,
)


def test_build_subtitle_batches_covers_all_blocks():
    blocks = [
        {"index": i, "start_time": "", "end_time": "", "text": f"第{i}条"}
        for i in range(1, 61)
    ]

    batches = SubtitleAnalyzer.build_subtitle_batches(blocks, batch_size=20, overlap=2)

    covered = sorted({item["index"] for batch in batches for item in batch["blocks"]})

    assert covered == list(range(1, 61))
    assert len(batches) >= 3


def test_build_analysis_prompt_includes_context_and_blocks():
    prompt = SubtitleAnalyzer.build_analysis_prompt(
        video_context={
            "title": "测试视频",
            "showtitle": "测试别名",
            "studio": "测试UP主",
            "runtime": "12",
            "intro": "这里是简介",
            "plot": "这里是剧情",
            "tags": ["动画", "搞笑"],
            "nfo_text": "整理后的说明文本",
        },
        batch_blocks=[
            {
                "index": 1,
                "start_time": "00:00:01,000",
                "end_time": "00:00:03,000",
                "text": "我门去看看",
            }
        ],
        batch_index=1,
        total_batches=4,
    )

    assert "测试视频" in prompt
    assert "测试UP主" in prompt
    assert "这里是简介" in prompt
    assert "我门去看看" in prompt
    assert "1/4" in prompt


def test_merge_correction_results_prefers_higher_confidence():
    results = [
        {
            "index": 2,
            "type": "typo",
            "text": "我门",
            "suggestion": "我们",
            "original_text": "我门",
            "corrected_text": "我们",
            "reason": "错别字",
            "confidence": 0.5,
        },
        {
            "index": 2,
            "type": "grammar",
            "text": "我门",
            "suggestion": "我们",
            "original_text": "我门",
            "corrected_text": "我们",
            "reason": "重复结果",
            "confidence": 0.9,
        },
    ]

    merged = SubtitleAnalyzer.merge_correction_results(results)

    assert len(merged) == 1
    assert merged[0]["confidence"] == 0.9
    assert merged[0]["type"] == "grammar"
