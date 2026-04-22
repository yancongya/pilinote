from src.services.ai.subtitle_analyzer import SubtitleAnalyzer


def _build_srt_content(count: int) -> str:
    blocks = []
    for index in range(1, count + 1):
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"00:00:{index:02d},000 --> 00:00:{index + 1:02d},000",
                    f"第{index}条字幕",
                ]
            )
        )
    return "\n\n".join(blocks)


def test_parse_subtitle_blocks_and_plan_batches_cover_all_blocks():
    analyzer = SubtitleAnalyzer()
    content = _build_srt_content(6)

    blocks = analyzer.parse_subtitle_blocks(content)
    batches = analyzer.plan_batches(blocks, batch_size=3, overlap=1)

    assert len(blocks) == 6
    assert blocks[0]["index"] == 1
    assert blocks[-1]["index"] == 6
    assert [block["index"] for block in batches[0]["blocks"]] == [1, 2, 3]
    assert [block["index"] for block in batches[1]["blocks"]] == [3, 4, 5]
    assert [block["index"] for block in batches[2]["blocks"]] == [5, 6]
    assert any(
        block["original_text"] == "第6条字幕"
        for batch in batches
        for block in batch["blocks"]
    )


def test_build_prompt_places_video_context_before_subtitles():
    analyzer = SubtitleAnalyzer()
    prompt = analyzer.build_prompt(
        video_context={
            "title": "样例标题",
            "studio": "样例工作室",
            "runtime": "01:23:45",
            "nfo_text": "NFO元数据说明",
        },
        batch_blocks=[
            {
                "index": 1,
                "type": "dialogue",
                "original_text": "第一句字幕",
                "raw_text": "1\n00:00:01,000 --> 00:00:02,000\n第一句字幕",
            }
        ],
        batch_index=1,
        batch_total=2,
    )

    assert "样例标题" in prompt
    assert "样例工作室" in prompt
    assert "NFO元数据说明" in prompt
    assert "第一句字幕" in prompt
    assert prompt.index("样例标题") < prompt.index("第一句字幕")
    assert prompt.index("NFO元数据说明") < prompt.index("第一句字幕")


def test_merge_issues_prefers_higher_confidence_and_keeps_backward_compatible_fields():
    analyzer = SubtitleAnalyzer()
    merged = analyzer.merge_issues(
        [
            {
                "issues": [
                    {
                        "index": 4,
                        "type": "typo",
                        "original_text": "错误A",
                        "corrected_text": "修正A",
                        "reason": "batch-1",
                        "confidence": 0.4,
                        "text": "错误A",
                        "suggestion": "修正A",
                    },
                    {
                        "index": 5,
                        "type": "term",
                        "original_text": "旧术语",
                        "corrected_text": "新术语",
                        "reason": "batch-1",
                        "confidence": 0.7,
                    },
                ]
            },
            {
                "issues": [
                    {
                        "index": 4,
                        "type": "typo",
                        "original_text": "错误B",
                        "corrected_text": "修正B",
                        "reason": "batch-2",
                        "confidence": 0.95,
                    }
                ]
            },
        ]
    )

    assert [issue["index"] for issue in merged["issues"]] == [4, 5]

    issue = next(item for item in merged["issues"] if item["index"] == 4)
    assert issue["original_text"] == "错误B"
    assert issue["corrected_text"] == "修正B"
    assert issue["text"] == "错误B"
    assert issue["suggestion"] == "修正B"
    assert issue["confidence"] == 0.95
