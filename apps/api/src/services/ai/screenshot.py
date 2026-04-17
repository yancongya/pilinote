import subprocess
import os
import glob
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class ScreenshotService:
    """视频截图服务"""

    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        count: int = 9,
        interval: Optional[int] = None,
    ) -> List[str]:
        """从视频提取关键帧"""
        os.makedirs(output_dir, exist_ok=True)

        if interval:
            return self._extract_by_interval(video_path, output_dir, interval, count)
        else:
            return self._extract_by_scenes(video_path, output_dir, count)

    def _extract_by_interval(
        self, video_path: str, output_dir: str, interval: int, count: int
    ) -> List[str]:
        """按固定时间间隔提取"""
        duration = self._get_duration(video_path)
        if not duration:
            return []

        timestamps = []
        for i in range(count):
            ts = (duration / count) * i + interval
            if ts < duration:
                timestamps.append(ts)

        output_files = []
        for i, ts in enumerate(timestamps):
            output_path = os.path.join(output_dir, f"screenshot_{i:03d}.jpg")
            self._extract_single_frame(video_path, output_path, ts)
            if os.path.exists(output_path):
                output_files.append(output_path)

        return output_files

    def _extract_by_scenes(
        self, video_path: str, output_dir: str, count: int
    ) -> List[str]:
        """按场景变化自动提取"""
        cmd = [
            self.ffmpeg_path,
            "-i",
            video_path,
            "-vf",
            "select=gt(scene\\,0.3),scale=320:-1",
            "-frames:v",
            str(count),
            "-q:v",
            "2",
            os.path.join(output_dir, "screenshot_%03d.jpg"),
        ]

        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError as e:
            logger.warning(f"Scene detection failed, falling back to interval: {e}")
            return self._extract_by_interval(video_path, output_dir, 30, count)

        files = sorted(glob.glob(os.path.join(output_dir, "screenshot_*.jpg")))
        return files[:count]

    def _extract_single_frame(
        self, video_path: str, output_path: str, timestamp: float
    ):
        """提取单帧"""
        cmd = [
            self.ffmpeg_path,
            "-ss",
            str(timestamp),
            "-i",
            video_path,
            "-vframes",
            "1",
            "-q:v",
            "2",
            "-y",
            output_path,
        ]
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def _get_duration(self, video_path: str) -> Optional[float]:
        """获取视频时长（秒）"""
        cmd = [self.ffmpeg_path, "-i", video_path]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            for line in result.stderr.split("\n"):
                if "Duration:" in line:
                    dur = line.split("Duration:")[1].split(",")[0].strip()
                    h, m, s = dur.split(":")
                    return float(h) * 3600 + float(m) * 60 + float(s)
        except Exception as e:
            logger.error(f"Failed to get duration: {e}")
        return None
