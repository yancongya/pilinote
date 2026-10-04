"""
修复现有NFO文件，添加BVID字段

从文件名中提取BVID并添加到NFO文件中
"""
import xml.etree.ElementTree as ET
import re
from pathlib import Path
from typing import Optional

def extract_bvid_from_path(nfo_path: Path) -> Optional[str]:
    """从文件路径中提取BVID"""
    # 1. 从NFO文件名中提取
    filename = nfo_path.stem
    bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', filename)
    if bvid_match:
        return bvid_match.group()
    
    # 2. 从目录名中提取
    dir_name = nfo_path.parent.name
    bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', dir_name)
    if bvid_match:
        return bvid_match.group()
    
    # 3. 从父目录名中提取
    parent_dir_name = nfo_path.parent.parent.name
    bvid_match = re.search(r'BV[a-zA-Z0-9]{10}', parent_dir_name)
    if bvid_match:
        return bvid_match.group()
    
    return None

def fix_nfo_file(nfo_path: Path) -> dict:
    """修复单个NFO文件"""
    try:
        # 读取现有NFO文件
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        
        # 检查是否已有BVID字段
        existing_bvid = root.find('bvid')
        if existing_bvid is not None:
            return {"success": False, "message": "已存在BVID字段", "path": str(nfo_path)}
        
        # 提取BVID
        bvid = extract_bvid_from_path(nfo_path)
        if not bvid:
            return {"success": False, "message": "无法从路径提取BVID", "path": str(nfo_path)}
        
        # 添加BVID字段（在title后面）
        title_elem = root.find('title')
        if title_elem is not None:
            # 在title元素后插入BVID
            title_index = list(root).index(title_elem)
            bvid_elem = ET.Element('bvid')
            bvid_elem.text = bvid
            root.insert(title_index + 1, bvid_elem)
        else:
            # 如果没有title，直接添加到开头
            bvid_elem = ET.Element('bvid')
            bvid_elem.text = bvid
            root.insert(0, bvid_elem)
        
        # 备份原文件
        backup_path = nfo_path.with_suffix('.nfo.old')
        with open(nfo_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_content)
        
        # 写入修复后的文件
        tree.write(nfo_path, encoding='utf-8', xml_declaration=True)
        
        return {"success": True, "message": f"添加BVID: {bvid}", "path": str(nfo_path), "bvid": bvid}
        
    except Exception as e:
        return {"success": False, "message": f"修复失败: {str(e)}", "path": str(nfo_path)}

def main():
    """主函数"""
    import sys
    
    if len(sys.argv) < 2:
        print("使用方法: python fix_nfo_files.py <下载目录>")
        print("例如: python fix_nfo_files.py ./downloads")
        sys.exit(1)
    
    download_dir = Path(sys.argv[1])
    if not download_dir.exists():
        print(f"目录不存在: {download_dir}")
        sys.exit(1)
    
    # 查找所有NFO文件
    nfo_files = list(download_dir.rglob("*.nfo"))
    
    if not nfo_files:
        print(f"在目录 {download_dir} 中没有找到NFO文件")
        sys.exit(0)
    
    print(f"找到 {len(nfo_files)} 个NFO文件")
    
    # 修复所有NFO文件
    results = []
    success_count = 0
    failed_count = 0
    skip_count = 0
    
    for nfo_path in nfo_files:
        result = fix_nfo_file(nfo_path)
        results.append(result)
        
        if result["success"]:
            success_count += 1
            print(f"✓ {result['path']}: {result['message']}")
        elif "已存在BVID" in result["message"]:
            skip_count += 1
            print(f"- {result['path']}: {result['message']}")
        else:
            failed_count += 1
            print(f"✗ {result['path']}: {result['message']}")
    
    print(f"\n修复完成: 成功 {success_count} 个, 跳过 {skip_count} 个, 失败 {failed_count} 个")

if __name__ == "__main__":
    main()