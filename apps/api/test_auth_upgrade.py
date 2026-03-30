#!/usr/bin/env python3
"""
认证升级功能测试脚本
测试Week 1和Week 2的功能：指纹管理和cookie刷新
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services.fingerprint_manager import FingerprintManager
from src.services.cookie_manager import CookieManager
from src.services.bilibili import BilibiliService


def test_fingerprint_manager():
    """测试指纹管理器（Week 1功能）"""
    print("=" * 60)
    print("测试指纹管理器（Week 1: 风控验证基础设施）")
    print("=" * 60)
    
    fingerprint_mgr = FingerprintManager()
    
    # 测试1: 生成buvid
    print("\n[测试1] 生成buvid指纹...")
    try:
        buvid_result = fingerprint_mgr.generate_buvid()
        print(f"✅ buvid生成成功")
        print(f"   - buvid3: {fingerprint_mgr.get_cookie('buvid3')}")
        print(f"   - buvid4: {fingerprint_mgr.get_cookie('buvid4')}")
        print(f"   - bili_jct: {fingerprint_mgr.get_cookie('bili_jct')}")
    except Exception as e:
        print(f"❌ buvid生成失败: {e}")
        return False
    
    # 测试2: 生成bili_ticket
    print("\n[测试2] 生成bili_ticket签名...")
    try:
        bili_csrf = fingerprint_mgr.get_bili_csrf()
        if bili_csrf:
            ticket_result = fingerprint_mgr.generate_bili_ticket(bili_csrf)
            print(f"✅ bili_ticket生成成功")
            print(f"   - bili_ticket: {fingerprint_mgr.get_cookie('bili_ticket')}")
        else:
            print(f"⚠️ 无法获取bili_jct，跳过bili_ticket测试")
    except Exception as e:
        print(f"❌ bili_ticket生成失败: {e}")
        return False
    
    # 测试3: 获取cookie字符串
    print("\n[测试3] 获取完整的cookie字符串...")
    try:
        cookie_string = fingerprint_mgr.get_cookies_string()
        print(f"✅ cookie字符串获取成功")
        print(f"   长度: {len(cookie_string)} 字符")
    except Exception as e:
        print(f"❌ cookie字符串获取失败: {e}")
        return False
    
    print("\n✅ 指纹管理器测试通过")
    return True


def test_cookie_manager():
    """测试cookie管理器（Week 2功能）"""
    print("\n" + "=" * 60)
    print("测试cookie管理器（Week 2: Cookie刷新机制）")
    print("=" * 60)
    
    cookie_mgr = CookieManager()
    
    # 测试1: 设置cookie
    print("\n[测试1] 设置cookie...")
    try:
        test_cookies = {
            "SESSDATA": "test_sessdata_12345",
            "bili_jct": "test_jct_67890",
            "DedeUserID": "test_user_54321"
        }
        cookie_mgr.set_cookies(test_cookies)
        print(f"✅ cookie设置成功")
        for key, value in test_cookies.items():
            stored_value = cookie_mgr.get_cookie(key)
            if stored_value == value:
                print(f"   - {key}: ✅")
            else:
                print(f"   - {key}: ❌ (期望: {value}, 实际: {stored_value})")
    except Exception as e:
        print(f"❌ cookie设置失败: {e}")
        return False
    
    # 测试2: 设置refresh_token
    print("\n[测试2] 设置refresh_token...")
    try:
        test_refresh_token = "test_refresh_token_xyz"
        cookie_mgr.set_refresh_token(test_refresh_token)
        stored_token = cookie_mgr.get_refresh_token()
        if stored_token == test_refresh_token:
            print(f"✅ refresh_token设置成功")
        else:
            print(f"❌ refresh_token不匹配 (期望: {test_refresh_token}, 实际: {stored_token})")
            return False
    except Exception as e:
        print(f"❌ refresh_token设置失败: {e}")
        return False
    
    # 测试3: 检查刷新时机
    print("\n[测试3] 检查cookie刷新时机...")
    try:
        should_refresh = cookie_mgr.should_refresh()
        print(f"✅ 刷新检查完成")
        print(f"   - 是否需要刷新: {'是' if should_refresh else '否'}")
        print(f"   - 剩余有效期: {cookie_mgr.get_remaining_time()} 秒")
    except Exception as e:
        print(f"❌ 刷新检查失败: {e}")
        return False
    
    # 测试4: 获取cookie字符串
    print("\n[测试4] 获取cookie字符串...")
    try:
        cookie_string = cookie_mgr.get_cookies_string()
        print(f"✅ cookie字符串获取成功")
        print(f"   长度: {len(cookie_string)} 字符")
    except Exception as e:
        print(f"❌ cookie字符串获取失败: {e}")
        return False
    
    print("\n✅ cookie管理器测试通过")
    return True


def test_bilibili_service_integration():
    """测试BilibiliService集成"""
    print("\n" + "=" * 60)
    print("测试BilibiliService集成（指纹+cookie管理）")
    print("=" * 60)
    
    service = BilibiliService()
    
    # 测试1: 初始化指纹
    print("\n[测试1] 初始化指纹系统...")
    try:
        init_result = service.init_fingerprint()
        if init_result["success"]:
            print(f"✅ 指纹系统初始化成功")
            print(f"   消息: {init_result['message']}")
        else:
            print(f"❌ 指纹系统初始化失败")
            print(f"   消息: {init_result['message']}")
            return False
    except Exception as e:
        print(f"❌ 指纹初始化异常: {e}")
        return False
    
    # 测试2: 检查cookie状态
    print("\n[测试2] 检查cookie状态...")
    try:
        check_result = service.check_and_refresh_cookies()
        print(f"✅ cookie状态检查完成")
        print(f"   消息: {check_result['message']}")
    except Exception as e:
        print(f"❌ cookie状态检查异常: {e}")
        return False
    
    print("\n✅ BilibiliService集成测试通过")
    return True


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("PiliNote 认证升级功能测试")
    print("=" * 60)
    print("\n测试范围:")
    print("  Week 1: 风控验证基础设施（buvid、bili_ticket）")
    print("  Week 2: Cookie刷新机制（refresh_token）")
    print("=" * 60)
    
    results = {}
    
    # 运行所有测试
    results["fingerprint_manager"] = test_fingerprint_manager()
    results["cookie_manager"] = test_cookie_manager()
    results["service_integration"] = test_bilibili_service_integration()
    
    # 打印测试结果摘要
    print("\n" + "=" * 60)
    print("测试结果摘要")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过！")
        print("\n下一步:")
        print("  1. Week 3: 实现Geetest验证支持")
        print("  2. Week 4: 实现加密和签名增强")
        print("  3. 更新前端支持新的认证方式")
    else:
        print("⚠️ 部分测试失败，请检查错误信息")
    print("=" * 60)
    
    return all_passed


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n测试执行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)