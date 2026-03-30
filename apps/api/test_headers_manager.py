"""
测试HeadersManager - 完全复刻BiliTools的架构
"""
import asyncio
from src.services.headers_manager import get_headers_manager, init_headers
from src.services.bilibili import BilibiliService
from src.services.geetest_service import GeetestService


async def test_headers_manager():
    """测试HeadersManager"""
    print("=" * 60)
    print("测试HeadersManager")
    print("=" * 60)
    
    # 初始化HeadersManager
    print("\n1. 初始化HeadersManager...")
    init_result = await init_headers()
    print(f"初始化结果: {init_result}")
    
    if init_result["success"]:
        print("\n2. 获取headers...")
        headers_manager = get_headers_manager()
        headers = await headers_manager.get_headers()
        
        print(f"Headers数量: {len(headers)}")
        print(f"Cookie: {headers.get('Cookie', '')[:100]}...")
        
        # 获取所有cookies
        cookies = headers_manager.get_cookies()
        print(f"\n3. Cookies详情:")
        for name, value in cookies.items():
            print(f"  {name}: {value[:50]}...")
        
        # 测试BilibiliService
        print("\n4. 测试BilibiliService...")
        service = BilibiliService()
        try:
            # 初始化服务
            await service.init()
            
            # 获取二维码
            qrcode_result = await service.get_qrcode()
            print(f"获取二维码结果: {qrcode_result['success']}")
            if qrcode_result["success"]:
                print(f"二维码URL: {qrcode_result['data']['url']}")
                print(f"二维码Key: {qrcode_result['data']['qrcode_key']}")
        finally:
            service.close()
        
        # 测试GeetestService
        print("\n5. 测试GeetestService...")
        geetest_service = GeetestService()
        try:
            captcha_result = await geetest_service.get_captcha_params()
            print(f"获取Geetest参数结果: {captcha_result['success']}")
            if captcha_result["success"]:
                print(f"Token: {captcha_result['data']['token']}")
                print(f"GT: {captcha_result['data']['gt']}")
                print(f"Challenge: {captcha_result['data']['challenge']}")
        finally:
            geetest_service.close()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_headers_manager())