# Main conftest.py for pytest configuration
# This file ensures pytest can find and configure the test environment properly

import sys
from pathlib import Path

# Add src directory to Python path for imports
API_ROOT = Path(__file__).resolve().parent
SRC_PATH = API_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

# Import all fixtures from tests/conftest.py
from tests.conftest import *