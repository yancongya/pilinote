import sys
import asyncio
import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import tempfile
import shutil
import os

# Add API root to Python path
API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_database_url():
    """Test database URL using in-memory SQLite."""
    return "sqlite:///:memory:"


@pytest.fixture(scope="session")
def test_engine(test_database_url):
    """Create test database engine with proper configuration for testing."""
    engine = create_engine(
        test_database_url,
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
        echo=False  # Set to True for SQL debugging
    )
    
    # Import and create tables only if database models are available
    try:
        from src.database import Base
        Base.metadata.create_all(bind=engine)
    except ImportError:
        # Database models not available yet, skip table creation
        pass
    
    yield engine
    
    # Cleanup
    try:
        from src.database import Base
        Base.metadata.drop_all(bind=engine)
    except ImportError:
        pass
    engine.dispose()


@pytest.fixture(scope="function")
def test_db_session(test_engine):
    """Create a test database session with proper transaction handling."""
    TestingSessionLocal = sessionmaker(
        autocommit=False, 
        autoflush=False, 
        bind=test_engine
    )
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest_asyncio.fixture(scope="function")
async def test_queue_manager():
    """Create a test instance of UnifiedQueueManager with proper async support."""
    # Mock the database session and other dependencies
    mock_session = MagicMock()
    mock_websocket_manager = AsyncMock()
    
    # Create a mock queue manager for now
    # This will be replaced with actual implementation when available
    mock_queue_manager = AsyncMock()
    mock_queue_manager.start = AsyncMock()
    mock_queue_manager.stop = AsyncMock()
    mock_queue_manager.submit_task = AsyncMock()
    mock_queue_manager.get_task_status = AsyncMock()
    mock_queue_manager.get_queue_status = AsyncMock()
    mock_queue_manager.pause_task = AsyncMock()
    mock_queue_manager.resume_task = AsyncMock()
    mock_queue_manager.cancel_task = AsyncMock()
    
    # Mock queue state
    mock_queue_manager.queues = {
        "BACKLOG": [],
        "READY": [],
        "ACTIVE": [],
        "COMPLETED": [],
        "FAILED": []
    }
    
    # Mock configuration
    mock_queue_manager.max_concurrent = 3
    mock_queue_manager.running = False
    
    # Initialize the queue manager
    await mock_queue_manager.start()
    mock_queue_manager.running = True
    
    yield mock_queue_manager
    
    # Cleanup
    mock_queue_manager.running = False
    await mock_queue_manager.stop()


@pytest_asyncio.fixture(scope="function")
async def test_database_connection():
    """Create test database connection with proper async support."""
    # For now, use SQLite in-memory database
    # This can be extended to use PostgreSQL when pytest-postgresql is configured
    database_url = "sqlite+aiosqlite:///:memory:"
    
    try:
        # Try to import async database components
        from src.database import AsyncSessionLocal, async_engine, Base
        
        # Create tables
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Create session
        async with AsyncSessionLocal() as session:
            yield session
            
        # Cleanup
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            
    except ImportError:
        # Fallback to mock if async database not available
        mock_session = AsyncMock()
        mock_session.add = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.close = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.scalar = AsyncMock()
        yield mock_session


@pytest.fixture(scope="function")
def mock_bilibili_api():
    """Mock bilibili API responses for testing."""
    mock_responses = {
        "video_info": {
            "code": 0,
            "data": {
                "bvid": "BV1xx411c7mD",
                "title": "测试视频",
                "pic": "https://example.com/cover.jpg",
                "owner": {
                    "name": "测试用户",
                    "face": "https://example.com/avatar.jpg"
                },
                "pages": [
                    {
                        "cid": 123456,
                        "page": 1,
                        "part": "P1"
                    }
                ]
            }
        },
        "download_urls": {
            "code": 0,
            "data": {
                "durl": [
                    {
                        "url": "https://example.com/video.mp4",
                        "size": 1024000
                    }
                ]
            }
        },
        "danmaku": {
            "code": 0,
            "data": [
                {
                    "p": "15.23600,1,25,0xffffff,1234567890,0,hash1,0",
                    "text": "测试弹幕1"
                },
                {
                    "p": "30.45200,1,25,0xffffff,1234567891,0,hash2,0", 
                    "text": "测试弹幕2"
                }
            ]
        }
    }
    return mock_responses


@pytest.fixture(scope="function")
def mock_websocket_manager():
    """Mock WebSocket manager for testing real-time communication."""
    mock_manager = AsyncMock()
    mock_manager.broadcast = AsyncMock()
    mock_manager.send_to_user = AsyncMock()
    mock_manager.connect = AsyncMock()
    mock_manager.disconnect = AsyncMock()
    return mock_manager


@pytest.fixture(scope="function")
def sample_task_data():
    """Sample task data for testing."""
    return {
        "media_type": "video",
        "media_id": "BV1xx411c7mD",
        "title": "测试视频",
        "quality": 80,
        "download_subtitles": True,
        "download_danmaku": True,
        "download_cover": True,
        "download_avatar": True,
        "generate_nfo": True
    }


@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """Setup test environment variables and configurations."""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("DOWNLOAD_PATH", "/tmp/test_downloads")
    monkeypatch.setenv("MAX_CONCURRENT_DOWNLOADS", "3")


@pytest.fixture(scope="function")
def temp_download_dir(tmp_path):
    """Create a temporary download directory for testing."""
    download_dir = tmp_path / "downloads"
    download_dir.mkdir()
    return download_dir


@pytest.fixture(scope="function")
def test_config():
    """Test configuration with safe defaults."""
    return {
        "database_url": "sqlite+aiosqlite:///:memory:",
        "max_concurrent_downloads": 3,
        "download_timeout": 300,
        "retry_attempts": 3,
        "retry_delay": 1,
        "websocket_heartbeat": 30,
        "log_level": "DEBUG",
        "testing": True
    }


@pytest.fixture(scope="function")
def mock_file_system(tmp_path):
    """Mock file system for testing file operations."""
    # Create test directory structure
    downloads_dir = tmp_path / "downloads"
    temp_dir = tmp_path / "temp"
    logs_dir = tmp_path / "logs"
    
    downloads_dir.mkdir()
    temp_dir.mkdir()
    logs_dir.mkdir()
    
    return {
        "downloads": downloads_dir,
        "temp": temp_dir,
        "logs": logs_dir,
        "root": tmp_path
    }


@pytest_asyncio.fixture(scope="function")
async def mock_task_orchestrator():
    """Mock task orchestrator for testing task execution."""
    mock_orchestrator = AsyncMock()
    mock_orchestrator.create_execution_plan = AsyncMock()
    mock_orchestrator.execute_task = AsyncMock()
    mock_orchestrator.get_execution_status = AsyncMock()
    mock_orchestrator.cancel_execution = AsyncMock()
    
    # Mock execution plan
    mock_orchestrator.create_execution_plan.return_value = {
        "subtasks": [
            {"type": "video", "priority": 1, "parallel": True},
            {"type": "danmaku", "priority": 1, "parallel": True},
            {"type": "cover", "priority": 2, "parallel": False},
            {"type": "avatar", "priority": 2, "parallel": False},
            {"type": "nfo", "priority": 3, "parallel": False},
            {"type": "subtitle", "priority": 3, "parallel": False}
        ]
    }
    
    return mock_orchestrator
