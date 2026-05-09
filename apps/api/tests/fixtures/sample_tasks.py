"""
测试用的Task和SubTask数据生成器

提供各种测试场景下的任务和子任务数据，包括：
- 不同状态的任务（BACKLOG, PENDING, ACTIVE, COMPLETED, FAILED等）
- 不同类型的媒体（video, bangumi, music等）
- 不同类型的子任务（video, subtitle, danmaku, cover, avatar, nfo）
- 各种进度状态和错误情况
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from src.models.task import Task, SubTask, TaskState, SubTaskType, MediaType, DownloadStage


class SampleTaskGenerator:
    """测试任务数据生成器"""
    
    @staticmethod
    def create_basic_video_task(
        task_id: Optional[str] = None,
        media_id: str = "BV1xx411c7mD",
        title: str = "测试视频标题",
        state: TaskState = TaskState.BACKLOG
    ) -> Dict[str, Any]:
        """创建基础视频任务数据"""
        if task_id is None:
            task_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': task_id,
            'media_type': MediaType.VIDEO.value,
            'media_id': media_id,
            'title': title,
            'cover': f'https://i2.hdslb.com/bfs/archive/{media_id}.jpg',
            'desc': '这是一个测试视频的描述信息',
            'meta': {
                'bvid': media_id,
                'aid': 123456789,
                'title': title,
                'desc': '这是一个测试视频的描述信息',
                'duration': 3600,  # 1小时
                'owner': {
                    'mid': 12345,
                    'name': '测试UP主',
                    'face': 'https://i2.hdslb.com/bfs/face/test.jpg'
                },
                'stat': {
                    'view': 10000,
                    'danmaku': 500,
                    'reply': 200,
                    'favorite': 300,
                    'coin': 150,
                    'share': 50,
                    'like': 800
                },
                'pages': [
                    {
                        'cid': 987654321,
                        'page': 1,
                        'from': 'vupload',
                        'part': '测试分P标题',
                        'duration': 3600,
                        'vid': '',
                        'weblink': '',
                        'dimension': {
                            'width': 1920,
                            'height': 1080,
                            'rotate': 0
                        }
                    }
                ]
            },
            'prepare': {
                'video_url': 'https://test-video-url.com/video.mp4',
                'audio_url': 'https://test-audio-url.com/audio.mp3',
                'subtitle_urls': {
                    'zh-CN': 'https://test-subtitle-url.com/subtitle.json'
                },
                'quality': 80,
                'format': 'mp4'
            },
            'status': {
                'progress': 0.0,
                'speed': 0.0,
                'eta': 0.0,
                'stage': DownloadStage.PREPARING.value,
                'downloaded': 0,
                'total': 0
            },
            'state': state.value,
            'error_detail': None,
            'scheduler_id': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_active_video_task(
        task_id: Optional[str] = None,
        progress: float = 45.5,
        speed: float = 1024000.0,  # 1MB/s
        downloaded: int = 50 * 1024 * 1024,  # 50MB
        total: int = 100 * 1024 * 1024  # 100MB
    ) -> Dict[str, Any]:
        """创建正在下载的视频任务"""
        task_data = SampleTaskGenerator.create_basic_video_task(
            task_id=task_id,
            state=TaskState.ACTIVE
        )
        
        eta = (total - downloaded) / speed if speed > 0 else 0
        
        task_data['status'] = {
            'progress': progress,
            'speed': speed,
            'eta': eta,
            'stage': DownloadStage.DOWNLOADING.value,
            'downloaded': downloaded,
            'total': total
        }
        
        return task_data
    
    @staticmethod
    def create_completed_video_task(
        task_id: Optional[str] = None,
        file_size: int = 100 * 1024 * 1024  # 100MB
    ) -> Dict[str, Any]:
        """创建已完成的视频任务"""
        task_data = SampleTaskGenerator.create_basic_video_task(
            task_id=task_id,
            state=TaskState.COMPLETED
        )
        
        task_data['status'] = {
            'progress': 100.0,
            'speed': 0.0,
            'eta': 0.0,
            'stage': DownloadStage.COMPLETED.value,
            'downloaded': file_size,
            'total': file_size
        }
        
        return task_data
    
    @staticmethod
    def create_failed_video_task(
        task_id: Optional[str] = None,
        error_type: str = "network_error",
        error_message: str = "网络连接超时"
    ) -> Dict[str, Any]:
        """创建失败的视频任务"""
        task_data = SampleTaskGenerator.create_basic_video_task(
            task_id=task_id,
            state=TaskState.FAILED
        )
        
        task_data['error_detail'] = {
            'type': error_type,
            'message': error_message,
            'code': 'NETWORK_TIMEOUT',
            'timestamp': int(datetime.now().timestamp()),
            'retry_count': 3,
            'max_retries': 3
        }
        
        return task_data
    
    @staticmethod
    def create_bangumi_task(
        task_id: Optional[str] = None,
        media_id: str = "ep123456",
        season_id: str = "ss12345"
    ) -> Dict[str, Any]:
        """创建番剧任务"""
        if task_id is None:
            task_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': task_id,
            'media_type': MediaType.BANGUMI.value,
            'media_id': media_id,
            'title': '测试番剧 第1话',
            'cover': f'https://i0.hdslb.com/bfs/bangumi/{season_id}.jpg',
            'desc': '这是一个测试番剧的描述',
            'meta': {
                'ep_id': media_id,
                'season_id': season_id,
                'title': '测试番剧 第1话',
                'long_title': '第一话：开始的故事',
                'cover': f'https://i0.hdslb.com/bfs/bangumi/{season_id}.jpg',
                'duration': 1440,  # 24分钟
                'pub_time': now - 86400,  # 1天前发布
                'stat': {
                    'play': 50000,
                    'danmaku': 1000,
                    'reply': 500
                }
            },
            'prepare': {
                'video_url': 'https://test-bangumi-video.com/video.mp4',
                'audio_url': 'https://test-bangumi-audio.com/audio.mp3',
                'quality': 80,
                'format': 'mp4'
            },
            'status': {
                'progress': 0.0,
                'speed': 0.0,
                'eta': 0.0,
                'stage': DownloadStage.PREPARING.value,
                'downloaded': 0,
                'total': 0
            },
            'state': TaskState.BACKLOG.value,
            'error_detail': None,
            'scheduler_id': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_music_task(
        task_id: Optional[str] = None,
        media_id: str = "au123456"
    ) -> Dict[str, Any]:
        """创建音乐任务"""
        if task_id is None:
            task_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': task_id,
            'media_type': MediaType.MUSIC.value,
            'media_id': media_id,
            'title': '测试音乐标题',
            'cover': f'https://i0.hdslb.com/bfs/music/{media_id}.jpg',
            'desc': '这是一个测试音乐的描述',
            'meta': {
                'auid': media_id,
                'title': '测试音乐标题',
                'author': '测试歌手',
                'duration': 240,  # 4分钟
                'cover': f'https://i0.hdslb.com/bfs/music/{media_id}.jpg'
            },
            'prepare': {
                'audio_url': 'https://test-music-url.com/music.mp3',
                'quality': 320,  # 320kbps
                'format': 'mp3'
            },
            'status': {
                'progress': 0.0,
                'speed': 0.0,
                'eta': 0.0,
                'stage': DownloadStage.PREPARING.value,
                'downloaded': 0,
                'total': 0
            },
            'state': TaskState.BACKLOG.value,
            'error_detail': None,
            'scheduler_id': None,
            'created_at': now,
            'updated_at': now
        }


class SampleSubTaskGenerator:
    """测试子任务数据生成器"""
    
    @staticmethod
    def create_video_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG,
        progress: int = 0,
        quality: int = 80
    ) -> Dict[str, Any]:
        """创建视频下载子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.VIDEO.value,
            'state': state.value,
            'progress': progress,
            'params': {
                'quality': quality,
                'format': 'mp4',
                'video_url': 'https://test-video-url.com/video.mp4',
                'audio_url': 'https://test-audio-url.com/audio.mp3',
                'merge_required': True
            },
            'output_path': f'/downloads/video_{task_id}_{quality}p.mp4',
            'file_size': 100 * 1024 * 1024 if state == TaskState.COMPLETED else None,
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_subtitle_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG,
        language: str = "zh-CN"
    ) -> Dict[str, Any]:
        """创建字幕下载子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.SUBTITLE.value,
            'state': state.value,
            'progress': 100 if state == TaskState.COMPLETED else 0,
            'params': {
                'language': language,
                'subtitle_url': f'https://test-subtitle-url.com/subtitle_{language}.json',
                'format': 'srt'
            },
            'output_path': f'/downloads/subtitle_{task_id}_{language}.srt',
            'file_size': 50 * 1024 if state == TaskState.COMPLETED else None,  # 50KB
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_danmaku_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG
    ) -> Dict[str, Any]:
        """创建弹幕下载子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.DANMAKU.value,
            'state': state.value,
            'progress': 100 if state == TaskState.COMPLETED else 0,
            'params': {
                'cid': 987654321,
                'format': 'xml'
            },
            'output_path': f'/downloads/danmaku_{task_id}.xml',
            'file_size': 200 * 1024 if state == TaskState.COMPLETED else None,  # 200KB
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_cover_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG
    ) -> Dict[str, Any]:
        """创建封面下载子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.COVER.value,
            'state': state.value,
            'progress': 100 if state == TaskState.COMPLETED else 0,
            'params': {
                'cover_url': 'https://i2.hdslb.com/bfs/archive/test.jpg',
                'format': 'jpg'
            },
            'output_path': f'/downloads/cover_{task_id}.jpg',
            'file_size': 500 * 1024 if state == TaskState.COMPLETED else None,  # 500KB
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_avatar_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG
    ) -> Dict[str, Any]:
        """创建头像下载子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.AVATAR.value,
            'state': state.value,
            'progress': 100 if state == TaskState.COMPLETED else 0,
            'params': {
                'avatar_url': 'https://i2.hdslb.com/bfs/face/test.jpg',
                'mid': 12345,
                'format': 'jpg'
            },
            'output_path': f'/downloads/avatar_{task_id}.jpg',
            'file_size': 100 * 1024 if state == TaskState.COMPLETED else None,  # 100KB
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_nfo_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        state: TaskState = TaskState.BACKLOG
    ) -> Dict[str, Any]:
        """创建NFO文件生成子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': SubTaskType.NFO.value,
            'state': state.value,
            'progress': 100 if state == TaskState.COMPLETED else 0,
            'params': {
                'template': 'kodi',
                'include_metadata': True
            },
            'output_path': f'/downloads/metadata_{task_id}.nfo',
            'file_size': 10 * 1024 if state == TaskState.COMPLETED else None,  # 10KB
            'error_detail': None,
            'created_at': now,
            'updated_at': now
        }
    
    @staticmethod
    def create_failed_subtask(
        subtask_id: Optional[str] = None,
        task_id: str = "test-task-id",
        subtask_type: SubTaskType = SubTaskType.VIDEO,
        error_type: str = "download_error",
        error_message: str = "下载失败"
    ) -> Dict[str, Any]:
        """创建失败的子任务"""
        if subtask_id is None:
            subtask_id = str(uuid.uuid4())
            
        now = int(datetime.now().timestamp())
        
        return {
            'id': subtask_id,
            'task_id': task_id,
            'type': subtask_type.value,
            'state': TaskState.FAILED.value,
            'progress': 0,
            'params': {},
            'output_path': None,
            'file_size': None,
            'error_detail': {
                'type': error_type,
                'message': error_message,
                'code': 'DOWNLOAD_FAILED',
                'timestamp': now,
                'retry_count': 3,
                'max_retries': 3
            },
            'created_at': now,
            'updated_at': now
        }


class SampleTaskSets:
    """预定义的测试任务集合"""
    
    @staticmethod
    def get_complete_task_with_subtasks() -> Dict[str, Any]:
        """获取包含所有子任务的完整任务"""
        task_id = str(uuid.uuid4())
        
        task = SampleTaskGenerator.create_basic_video_task(task_id=task_id)
        
        subtasks = [
            SampleSubTaskGenerator.create_video_subtask(task_id=task_id),
            SampleSubTaskGenerator.create_subtitle_subtask(task_id=task_id),
            SampleSubTaskGenerator.create_danmaku_subtask(task_id=task_id),
            SampleSubTaskGenerator.create_cover_subtask(task_id=task_id),
            SampleSubTaskGenerator.create_avatar_subtask(task_id=task_id),
            SampleSubTaskGenerator.create_nfo_subtask(task_id=task_id)
        ]
        
        return {
            'task': task,
            'subtasks': subtasks
        }
    
    @staticmethod
    def get_active_download_scenario() -> Dict[str, Any]:
        """获取正在下载的场景数据"""
        task_id = str(uuid.uuid4())
        
        task = SampleTaskGenerator.create_active_video_task(task_id=task_id)
        
        subtasks = [
            SampleSubTaskGenerator.create_video_subtask(
                task_id=task_id, 
                state=TaskState.ACTIVE, 
                progress=45
            ),
            SampleSubTaskGenerator.create_subtitle_subtask(
                task_id=task_id, 
                state=TaskState.COMPLETED
            ),
            SampleSubTaskGenerator.create_danmaku_subtask(
                task_id=task_id, 
                state=TaskState.COMPLETED
            ),
            SampleSubTaskGenerator.create_cover_subtask(
                task_id=task_id, 
                state=TaskState.PENDING
            ),
            SampleSubTaskGenerator.create_avatar_subtask(
                task_id=task_id, 
                state=TaskState.PENDING
            ),
            SampleSubTaskGenerator.create_nfo_subtask(
                task_id=task_id, 
                state=TaskState.PENDING
            )
        ]
        
        return {
            'task': task,
            'subtasks': subtasks
        }
    
    @staticmethod
    def get_failed_download_scenario() -> Dict[str, Any]:
        """获取下载失败的场景数据"""
        task_id = str(uuid.uuid4())
        
        task = SampleTaskGenerator.create_failed_video_task(task_id=task_id)
        
        subtasks = [
            SampleSubTaskGenerator.create_failed_subtask(
                task_id=task_id,
                subtask_type=SubTaskType.VIDEO,
                error_type="network_error",
                error_message="网络连接超时"
            ),
            SampleSubTaskGenerator.create_subtitle_subtask(
                task_id=task_id, 
                state=TaskState.COMPLETED
            ),
            SampleSubTaskGenerator.create_danmaku_subtask(
                task_id=task_id, 
                state=TaskState.COMPLETED
            ),
            SampleSubTaskGenerator.create_cover_subtask(
                task_id=task_id, 
                state=TaskState.CANCELLED
            ),
            SampleSubTaskGenerator.create_avatar_subtask(
                task_id=task_id, 
                state=TaskState.CANCELLED
            ),
            SampleSubTaskGenerator.create_nfo_subtask(
                task_id=task_id, 
                state=TaskState.CANCELLED
            )
        ]
        
        return {
            'task': task,
            'subtasks': subtasks
        }
    
    @staticmethod
    def get_mixed_media_tasks() -> List[Dict[str, Any]]:
        """获取混合媒体类型的任务列表"""
        return [
            SampleTaskGenerator.create_basic_video_task(
                media_id="BV1xx411c7mD",
                title="测试视频1"
            ),
            SampleTaskGenerator.create_bangumi_task(
                media_id="ep123456",
                season_id="ss12345"
            ),
            SampleTaskGenerator.create_music_task(
                media_id="au123456"
            ),
            SampleTaskGenerator.create_active_video_task(
                media_id="BV2yy411c8nE",
                progress=75.0
            ),
            SampleTaskGenerator.create_completed_video_task(
                media_id="BV3zz411c9oF"
            )
        ]