import asyncio
import json
from src.services.bilibili import BilibiliService

async def test_favorite_data():
    """测试收藏夹API返回的数据结构"""
    service = BilibiliService()
    
    # 使用真实的SESSDATA进行测试（需要用户提供）
    # 这里使用测试数据，实际使用时需要替换为真实的SESSDATA
    test_sessdata = "test_sessdata_here"
    test_mid = 123456
    test_folder_id = 123456
    
    try:
        # 获取收藏夹详情
        result = await service.get_folder_detail(
            sessdata=test_sessdata,
            media_id=test_folder_id,
            page=1,
            page_size=2
        )
        
        if result["success"]:
            data = result["data"]
            print("收藏夹API返回数据结构：")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 检查medias中的数据结构
            if "medias" in data and len(data["medias"]) > 0:
                first_media = data["medias"][0]
                print("\n第一个视频的完整数据：")
                print(json.dumps(first_media, indent=2, ensure_ascii=False))
                
                print("\n统计数据检查：")
                print(f"cnt_info字段: {first_media.get('cnt_info', {})}")
                print(f"upper字段: {first_media.get('upper', {})}")
        else:
            print(f"API调用失败: {result['message']}")
    except Exception as e:
        print(f"测试异常: {str(e)}")
    finally:
        service.close()

if __name__ == "__main__":
    asyncio.run(test_favorite_data())