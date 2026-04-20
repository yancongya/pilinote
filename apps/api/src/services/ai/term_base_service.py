import os
import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class TermBaseService:
    """术语库服务 - 加载和管理术语替换规则"""

    def __init__(self, term_bases_dir: Optional[str] = None):
        if term_bases_dir:
            self.term_bases_dir = Path(term_bases_dir)
        else:
            project_root = Path("/Users/tanyancong/工作/开发/pilinote")
            self.term_bases_dir = project_root / "term-bases"

        self._term_cache: Dict[str, Tuple[str, str]] = {}  # source -> (target, note)
        self._loaded = False

    def load(self) -> None:
        """加载所有术语库文件"""
        if not self.term_bases_dir.exists():
            logger.warning(f"术语库目录不存在: {self.term_bases_dir}")
            return

        self._term_cache.clear()

        # 按优先级加载：custom > product > tech
        files_order = ["tech.csv", "product.csv", "custom.csv"]

        for filename in files_order:
            filepath = self.term_bases_dir / filename
            if filepath.exists():
                self._load_csv_file(filepath)

        self._loaded = True
        logger.info(f"已加载 {len(self._term_cache)} 条术语规则")

    def _load_csv_file(self, filepath: Path) -> None:
        """加载单个CSV文件"""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    source = row.get("原术语", "").strip()
                    target = row.get("替换术语", "").strip()
                    note = row.get("备注", "").strip()

                    if source and target:
                        self._term_cache[source] = (target, note)
        except Exception as e:
            logger.warning(f"加载术语库文件失败 {filepath}: {e}")

    def get_all_terms(self) -> List[Dict[str, str]]:
        """获取所有术语列表"""
        if not self._loaded:
            self.load()

        terms = []
        for source, (target, note) in self._term_cache.items():
            terms.append({"source": source, "target": target, "note": note})
        return terms

    def replace_term(self, text: str) -> Tuple[str, List[Dict[str, str]]]:
        """替换文本中的术语

        Returns:
            (替换后的文本, 替换记录列表)
        """
        if not self._loaded:
            self.load()

        replaced = text
        replacements = []

        for source, (target, note) in self._term_cache.items():
            if source in replaced:
                replaced = replaced.replace(source, target)
                replacements.append({"source": source, "target": target, "note": note})

        return replaced, replacements

    def add_term(
        self, source: str, target: str, note: str = "", filename: str = "custom.csv"
    ) -> bool:
        """添加新术语"""
        filepath = self.term_bases_dir / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)

        file_exists = filepath.exists()

        with open(filepath, "a", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["原术语", "替换术语", "备注"])
            writer.writerow([source, target, note])

        self._loaded = False  # 清除缓存，下次的加载
        logger.info(f"添加术语: {source} -> {target}")
        return True

    def delete_term(self, source: str, filename: str = "custom.csv") -> bool:
        """删除术语（从custom.csv中）"""
        filepath = self.term_bases_dir / filename
        if not filepath.exists():
            return False

        rows = []
        deleted = False
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("原术语", "").strip() != source:
                    rows.append(row)
                else:
                    deleted = True

        if deleted:
            with open(filepath, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["原术语", "替换术语", "备注"])
                for row in rows:
                    writer.writerow(
                        [
                            row.get("原术语", ""),
                            row.get("替换术语", ""),
                            row.get("备注", ""),
                        ]
                    )

            self._loaded = False
            logger.info(f"删除术语: {source}")

        return deleted

    def list_files(self) -> List[str]:
        """列出所有术语库文件"""
        if not self.term_bases_dir.exists():
            return []

        files = []
        for f in self.term_bases_dir.iterdir():
            if f.is_file() and f.suffix == ".csv":
                files.append(f.name)
        return files

    def load_files(self, filenames: List[str]) -> Dict[str, Tuple[str, str]]:
        """按指定文件加载术语，返回 {source -> (target, note)}，不修改全局缓存

        Args:
            filenames: 要加载的文件名列表，如 ["tech.csv", "product.csv"]

        Returns:
            术语字典，后加载的文件会覆盖先加载的同名术语
        """
        result: Dict[str, Tuple[str, str]] = {}
        for filename in filenames:
            filepath = self.term_bases_dir / filename
            if filepath.exists():
                temp_cache: Dict[str, Tuple[str, str]] = {}
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            source = row.get("原术语", "").strip()
                            target = row.get("替换术语", "").strip()
                            note = row.get("备注", "").strip()
                            if source and target:
                                temp_cache[source] = (target, note)
                except Exception as e:
                    logger.warning(f"加载术语库文件失败 {filepath}: {e}")
                result.update(temp_cache)
        return result

    def preview_replacements(self, content: str, filenames: Optional[List[str]] = None) -> List[Dict[str, str]]:
        """预览字幕内容中会被替换的术语（不修改内容）

        Args:
            content: SRT 字幕内容
            filenames: 可选，指定要使用的术语库文件列表。None 表示使用全局缓存

        Returns:
            替换记录列表，包含 source, target, note, filename
        """
        if filenames:
            # 按指定文件加载术语
            terms = self.load_files(filenames)
        else:
            # 使用全局缓存
            if not self._loaded:
                self.load()
            terms = self._term_cache

        replacements = []
        # 只检查文本行（跳过索引和时间戳）
        for line in content.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.isdigit() or "-->" in stripped:
                continue
            for source, (target, note) in terms.items():
                if source in stripped:
                    replacements.append({"source": source, "target": target, "note": note})

        return replacements

    def apply_terms(self, content: str, filenames: Optional[List[str]] = None) -> Tuple[str, List[Dict[str, str]]]:
        """应用术语替换到字幕内容

        Args:
            content: SRT 字幕内容
            filenames: 可选，指定要使用的术语库文件列表。None 表示使用全局缓存

        Returns:
            (替换后的内容, 替换记录列表)
        """
        if filenames:
            terms = self.load_files(filenames)
        else:
            if not self._loaded:
                self.load()
            terms = self._term_cache

        lines = content.split("\n")
        result_lines = []
        all_replacements = []

        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.isdigit() or "-->" in stripped:
                result_lines.append(line)
                continue

            replaced = line
            for source, (target, note) in terms.items():
                if source in replaced:
                    replaced = replaced.replace(source, target)
                    all_replacements.append({"source": source, "target": target, "note": note})
            result_lines.append(replaced)

        return "\n".join(result_lines), all_replacements


# 全局实例
term_base_service = TermBaseService()
