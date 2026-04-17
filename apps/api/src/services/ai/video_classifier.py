from typing import Dict, Optional


CATEGORY_KEYWORDS = {
    "tutorial": [
        "教程",
        "教学",
        "怎么",
        "如何",
        "学习",
        "入门",
        "基础",
        "技巧",
        "教你",
        "手把手",
        "课程",
        "培训",
        "零基础",
        "学会",
        "掌握",
    ],
    "academic": [
        "研究",
        "分析",
        "原理",
        "机制",
        "科学",
        "理论",
        "论文",
        "探讨",
        "论述",
        "观点",
        "报告",
        "数据",
        "实验",
        "发现",
    ],
    "life_journal": [
        "生活",
        "日常",
        "今天",
        "分享",
        "感悟",
        "心情",
        "日记",
        "周末",
        "休息",
        "放松",
        "打卡",
        "Vlog",
        "记录",
        "碎片",
    ],
    "xiaohongshu": [
        "好物",
        "推荐",
        "必看",
        "宝藏",
        "神器",
        "必备",
        "好用到哭",
        "绝绝子",
        "YYDS",
        "私藏",
        "干货",
        "测评",
    ],
    "business": [
        "商业",
        "营销",
        "增长",
        "流量",
        "变现",
        "赚钱",
        "创业",
        "融资",
        "项目",
        "合作",
        "品牌",
        "投资",
        "经济",
    ],
    "task_oriented": [
        "任务",
        "待办",
        "计划",
        "目标",
        "清单",
        "高效",
        "整理",
        "汇总",
        "总结",
        "清单",
        "打卡",
        "习惯",
        "自律",
    ],
    "meeting_minutes": [
        "会议",
        "纪要",
        "总结会",
        "周会",
        "例会",
        "汇报",
        "发言",
    ],
}


class VideoClassifier:
    """视频类型分类器"""

    @staticmethod
    def classify(title: str, tags: str = "", description: str = "") -> Dict:
        """分类视频并推荐风格"""
        text = f"{title} {tags or ''} {description or ''}".lower()

        scores = {}
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw.lower() in text)
            if score > 0:
                scores[category] = score

        if not scores:
            return {
                "category": "general",
                "confidence": 0.0,
                "recommended_style": "detailed",
                "reason": "未能识别特定类型，使用默认风格",
            }

        top_category = max(scores.items(), key=lambda x: x[1])
        category, score = top_category

        style_map = {
            "tutorial": "tutorial",
            "academic": "academic",
            "life_journal": "life_journal",
            "xiaohongshu": "xiaohongshu",
            "business": "business",
            "task_oriented": "task_oriented",
            "meeting_minutes": "meeting_minutes",
        }

        return {
            "category": category,
            "confidence": min(score / 3, 1.0),
            "recommended_style": style_map.get(category, "detailed"),
            "reason": f"检测到关键词: {category}",
        }

    @staticmethod
    def get_recommended_style(title: str, tags: str = "", description: str = "") -> str:
        """直接获取推荐风格"""
        result = VideoClassifier.classify(title, tags, description)
        return result["recommended_style"]
