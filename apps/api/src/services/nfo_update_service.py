"""
NFO更新服务

基于本地NFO文件更新元数据，使用现有的B站API获取最新信息
"""
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from src.services.bilibili import BilibiliService
from src.services.queue.handlers.nfo import SingleNfoHandler

logger = logging.getLogger(__name__)


class NFOUpdateService:
    """NFO文件更新服务"""

    def __init__(self):
        self.bilibili_service = BilibiliService()
        self.nfo_handler = SingleNfoHandler()

    async def update_single_nfo(self, nfo_path: str) -> Dict[str, Any]:
        """
        更新单个NFO文件

        Args:
            nfo_path: NFO文件路径

        Returns:
            Dict: 更新结果
        """
        try:
            # 1. 读取现有NFO文件，提取BVID
            existing_data = self._parse_nfo_file(nfo_path)
            bvid = existing_data.get('bvid')

            if not bvid:
                # 尝试从文件名中提取BVID
                bvid = self._extract_bvid_from_filename(nfo_path)
                
                if not bvid:
                    return {
                        "success": False,
                        "message": "NFO文件中缺少BVID字段，且无法从文件名提取BVID",
                        "nfo_path": nfo_path
                    }
                
                logger.info(f"从文件名提取BVID: {bvid}")

            logger.info(f"开始更新NFO文件: {nfo_path}, BVID: {bvid}")

            # 2. 调用现有API获取最新信息
            result = await self.bilibili_service.get_video_info(bvid)

            if not result.get("success"):
                return {
                    "success": False,
                    "message": f"获取视频信息失败: {result.get('message', '未知错误')}",
                    "nfo_path": nfo_path,
                    "bvid": bvid
                }

            video_info = result["data"]

            # 3. 构建用于生成NFO的meta数据
            meta = self._build_meta_from_video_info(video_info, bvid)
            
            # 3.5. 获取评论数据（如果有aid）
            if meta.get('aid'):
                try:
                    comments_result = await self.bilibili_service.get_video_comments(
                        meta['aid'], 
                        ""  # 不需要sessdata获取公开评论
                    )
                    
                    if comments_result.get("success"):
                        comments_data = comments_result.get("data", {})
                        comments = comments_data.get("comments", [])
                        if comments:
                            meta['comments'] = comments
                            logger.info(f"获取到{len(comments)}条评论")
                except Exception as e:
                    logger.warning(f"获取评论数据失败: {e}")
                    # 评论获取失败不影响NFO更新
                    pass

            # 4. 重新生成NFO内容
            nfo_content = self.nfo_handler._generate_nfo(meta)

            # 5. 备份原始NFO文件
            backup_path = self._backup_nfo_file(nfo_path)

            # 6. 更新NFO文件
            with open(nfo_path, 'w', encoding='utf-8') as f:
                f.write(nfo_content)

            logger.info(f"NFO文件更新成功: {nfo_path}")

            return {
                "success": True,
                "message": "NFO文件更新成功",
                "nfo_path": nfo_path,
                "bvid": bvid,
                "backup_path": backup_path,
                "updated_fields": list(video_info.keys())
            }

        except Exception as e:
            logger.error(f"更新NFO文件失败: {nfo_path}, 错误: {e}")
            return {
                "success": False,
                "message": f"更新NFO文件失败: {str(e)}",
                "nfo_path": nfo_path
            }

    async def batch_update_nfos(self, directory: str, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """
        批量更新目录下的NFO文件（支持分页）

        Args:
            directory: 目录路径
            limit: 最大更新数量
            offset: 跳过的文件数量（用于分页）

        Returns:
            Dict: 批量更新结果
        """
        try:
            dir_path = Path(directory)
            if not dir_path.exists():
                return {
                    "success": False,
                    "message": f"目录不存在: {directory}"
                }

            # 查找所有NFO文件
            nfo_files = list(dir_path.rglob("*.nfo"))
            
            if not nfo_files:
                return {
                    "success": False,
                    "message": f"目录中没有找到NFO文件: {directory}"
                }

            # 支持分页：跳过offset个文件，取limit个
            nfo_files = nfo_files[offset:offset + limit]
            
            # 如果没有文件需要处理
            if not nfo_files:
                return {
                    "success": True,
                    "message": "没有更多文件需要更新",
                    "total": 0,
                    "success_count": 0,
                    "failed_count": 0,
                    "results": []
                }

            logger.info(f"开始批量更新NFO文件，共{len(nfo_files)}个文件")

            results = []
            success_count = 0
            failed_count = 0

            for nfo_path in nfo_files:
                logger.info(f"处理NFO文件: {nfo_path}")
                result = await self.update_single_nfo(str(nfo_path))
                results.append(result)
                
                if result.get("success"):
                    success_count += 1
                    logger.info(f"✓ NFO更新成功: {nfo_path}")
                else:
                    failed_count += 1
                    logger.warning(f"✗ NFO更新失败: {nfo_path}, 原因: {result.get('message', '未知错误')}")

            return {
                "success": True,
                "message": f"批量更新完成: 成功{success_count}个, 失败{failed_count}个",
                "total": len(nfo_files),
                "success_count": success_count,
                "failed_count": failed_count,
                "results": results
            }

        except Exception as e:
            logger.error(f"批量更新NFO文件失败: {e}")
            return {
                "success": False,
                "message": f"批量更新失败: {str(e)}"
            }

    def _parse_nfo_file(self, nfo_path: str) -> Dict[str, Any]:
        """解析NFO文件，提取BVID等信息"""
        try:
            tree = ET.parse(nfo_path)
            root = tree.getroot()

            metadata = {}

            # 提取BVID
            bvid_elem = root.find('bvid')
            if bvid_elem is not None and bvid_elem.text:
                metadata['bvid'] = bvid_elem.text

            # 提取其他可能需要的信息
            title_elem = root.find('title')
            if title_elem is not None and title_elem.text:
                metadata['title'] = title_elem.text

            return metadata

        except Exception as e:
            logger.warning(f"解析NFO文件失败: {nfo_path}, 错误: {e}")
            return {}

    def _extract_bvid_from_filename(self, nfo_path: str) -> Optional[str]:
        """从文件名或目录名中提取BVID"""
        import re
        
        try:
            # 1. 从NFO文件名中提取
            filename = Path(nfo_path).stem
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', filename)
            if bvid_match:
                return bvid_match.group()
            
            # 2. 从目录名中提取
            dir_name = Path(nfo_path).parent.name
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', dir_name)
            if bvid_match:
                return bvid_match.group()
            
            # 3. 从父目录名中提取
            parent_dir_name = Path(nfo_path).parent.parent.name
            bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', parent_dir_name)
            if bvid_match:
                return bvid_match.group()
            
            return None
            
        except Exception as e:
            logger.warning(f"从文件名提取BVID失败: {nfo_path}, 错误: {e}")
            return None

    def _build_meta_from_video_info(self, video_info: Dict[str, Any], bvid: str) -> Dict[str, Any]:
        """从视频信息构建NFO生成所需的meta数据"""
        return {
            "bvid": bvid,
            "aid": video_info.get("aid", 0),  # 添加aid用于获取评论
            "title": video_info.get("title", ""),
            "desc": video_info.get("desc", ""),
            "owner": video_info.get("owner", {}),
            "pubdate": video_info.get("pubdate", 0),
            "pic": video_info.get("pic", ""),
            "stat": video_info.get("stat", {}),
            "duration": video_info.get("duration", 0),
            "tags": video_info.get("tags", [])
        }

    def _backup_nfo_file(self, nfo_path: str) -> Optional[str]:
        """备份NFO文件"""
        try:
            nfo_file = Path(nfo_path)
            backup_path = nfo_file.with_suffix('.nfo.bak')
            
            # 读取原始内容
            with open(nfo_file, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # 写入备份文件
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            
            logger.debug(f"NFO文件备份成功: {backup_path}")
            return str(backup_path)

        except Exception as e:
            logger.warning(f"备份NFO文件失败: {nfo_path}, 错误: {e}")
            return None