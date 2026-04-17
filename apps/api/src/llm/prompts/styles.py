def get_minimal_style() -> str:
    """精简风格"""
    return "1. **精简信息**: 仅记录最重要的内容，简洁明了。"


def get_detailed_style() -> str:
    """详细风格"""
    return "2. **详细记录**: 包含完整的内容和每个部分的详细讨论。需要尽可能多的记录视频内容，最好详细的笔记"


def get_academic_style() -> str:
    """学术风格"""
    return "3. **学术风格**: 适合学术报告，正式且结构化。"


def get_xiaohongshu_style() -> str:
    """小红书风格"""
    return """4. **小红书风格**:
### 擅长使用下面的爆款关键词：
好用到哭，大数据，教科书般，小白必看，宝藏，绝绝子神器，都给我冲,划重点，笑不活了，YYDS，秘方，我不允许，压箱底，建议收藏，停止摆烂，上天在提醒你，挑战全网，手把手，揭秘，普通女生，沉浸式，有手就能做吹爆，好用哭了，搞钱必看，狠狠搞钱，打工人，吐血整理，家人们，隐藏，高级感，治愈，破防了，万万没想到，爆款，永远可以相信被夸爆手残党必备，正确姿势

### 采用二极管标题法创作标题：
- 正面刺激法:产品或方法+只需1秒 (短期)+便可开挂（逆天效果）
- 负面刺激法:你不XXX+绝对会后悔 (天大损失) +(紧迫感)
利用人们厌恶损失和负面偏误的心理

### 写作技巧
1. 使用惊叹号、省略号等标点符号增强表达力，营造紧迫感和惊喜感。
2. **使用emoji表情符号，来增加文字的活力**
3. 采用具有挑战性和悬念的表述，引发读、"无敌者好奇心，例如"暴涨词汇量"了"、"拒绝焦虑"等
4. 利用正面刺激和负面激，诱发读者的本能需求和动物基本驱动力，如"离离原上谱"、"你不知道的项目其实很赚"等
5. 融入热点话题和实用工具，提高文章的实用性和时效性，如"2023年必知"、"chatGPT狂飙进行时"等
6. 描述具体的成果和效果，强调标题中的关键词，使其更具吸引力，例如"英语底子再差，搞清这些语法你也能拿130+"
7. 使用吸引人的标题："""


def get_life_journal_style() -> str:
    """生活向风格"""
    return "5. **生活向**: 记录个人生活感悟，情感化表达。"


def get_task_oriented_style() -> str:
    """任务导向风格"""
    return "6. **任务导向**: 强调任务、目标，适合工作和待办事项。"


def get_business_style() -> str:
    """商业风格"""
    return "7. **商业风格**: 适合商业报告、会议纪要，正式且精准。"


def get_meeting_minutes_style() -> str:
    """会议纪要风格"""
    return "8. **会议纪要**: 适合商业报告、会议纪要，正式且精准。"


def get_tutorial_style() -> str:
    """教程风格"""
    return "9. **教程笔记**: 尽可能详细地记录教程，特别是关键点和一些重要的结论步骤"


def get_style_template(style: str) -> str:
    """获取指定风格的模板"""
    style_map = {
        "minimal": get_minimal_style,
        "detailed": get_detailed_style,
        "academic": get_academic_style,
        "xiaohongshu": get_xiaohongshu_style,
        "life_journal": get_life_journal_style,
        "task_oriented": get_task_oriented_style,
        "business": get_business_style,
        "meeting_minutes": get_meeting_minutes_style,
        "tutorial": get_tutorial_style,
    }
    return style_map.get(style, lambda: "")()


def get_all_style_templates(styles: list) -> str:
    """获取所有风格的模板（通常只用一种）"""
    if not styles:
        return ""
    return "\n".join([get_style_template(s) for s in styles])
