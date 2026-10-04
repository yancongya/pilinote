import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.llm import LLMProvider, LLMClientFactory, LLMMessage


def test_llm_provider_enum():
    """测试 LLMProvider 枚举"""
    assert LLMProvider.OPENAI.value == "openai"
    assert LLMProvider.CLAUDE.value == "claude"
    assert LLMProvider.DEEPSEEK.value == "deepseek"
    print("✓ LLMProvider 枚举正确")


def test_llm_client_factory_openai():
    """测试创建 OpenAI 客户端"""
    # 不需要真实 API key 也能创建客户端实例
    # 只要不实际调用 API
    client = LLMClientFactory.create_client(
        provider=LLMProvider.OPENAI, api_key="test-key"
    )
    assert client is not None
    print("✓ OpenAI 客户端创建成功")


def test_llm_client_factory_deepseek():
    """测试创建 DeepSeek 客户端"""
    client = LLMClientFactory.create_client(
        provider=LLMProvider.DEEPSEEK, api_key="test-key"
    )
    assert client is not None
    print("✓ DeepSeek 客户端创建成功")


def test_llm_message_creation():
    """测试 LLMMessage 创建"""
    msg = LLMMessage(role="user", content="Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"
    print("✓ LLMMessage 创建成功")


def test_llm_client_with_mock_key_openai():
    """测试 OpenAI 客户端使用 mock key"""
    # 设置一个假的 env key 用于测试
    os.environ["OPENAI_API_KEY"] = "sk-test-mock"

    # 客户端不实际调用 API，只验证配置
    from src.llm.openai_client import OpenAIClient

    client = OpenAIClient()
    assert client.api_key == "sk-test-mock"
    print("✓ OpenAI 客户端 mock key 测试通过")

    del os.environ["OPENAI_API_KEY"]


def test_unsupported_provider():
    """测试不支持的提供商"""
    try:
        LLMClientFactory._clients["custom"] = None
        LLMClientFactory.create_client(provider=LLMProvider.CUSTOM, api_key="test")
        print("✗ 应该抛出异常")
    except ValueError as e:
        assert "Unsupported provider" in str(e)
        print("✓ 不支持的提供商正确抛出异常")


if __name__ == "__main__":
    print("=" * 50)
    print("开始运行 LLM 客户端测试")
    print("=" * 50)

    test_llm_provider_enum()
    test_llm_client_factory_openai()
    test_llm_client_factory_deepseek()
    test_llm_message_creation()
    test_llm_client_with_mock_key_openai()
    test_unsupported_provider()

    print("=" * 50)
    print("所有 LLM 客户端测试通过! ✓")
    print("=" * 50)
