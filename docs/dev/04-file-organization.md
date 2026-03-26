# 文件组织方案

## 文件夹结构
```
单个视频: BV号_标题/
  ├─ video.mp4
  ├─ subtitle.srt
  ├─ danmu.xml
  ├─ audio.m4a (可选)
  └─ metadata.json

合集: BV号_合集名/
  ├─ P01_视频1/
  ├─ P02_视频2/
  └─ P03_视频3/
```

## 元数据格式
```json
{
  "bvid": "BVxxx",
  "aid": 123456,
  "title": "视频标题",
  "pic": "封面URL",
  "owner": {
    "mid": 123,
    "name": "UP主",
    "face": "头像URL"
  },
  "stat": {
    "view": 1000,
    "danmaku": 100,
    "reply": 50,
    "favorite": 20,
    "coin": 10,
    "share": 5
  },
  "pubdate": 1234567890,
  "duration": 600,
  "download_time": "2026-03-26T00:00:00",
  "quality": "1080P"
}
```

## 自动处理
- 并行下载: 字幕、弹幕、音轨
- 自动提取: 音轨分离
- 统一格式: JSON元数据

## 参考实现
- `reference/hermes/` (文件组织)
- `reference/bilibili-downloader/` (文件命名)