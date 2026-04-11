#!/bin/bash
cd "$(dirname "$0")/apps/api"
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000