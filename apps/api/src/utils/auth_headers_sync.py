"""Utility to sync cookies from DB into HeadersManager memory and refresh headers.

This centralizes the repeated pattern of loading active user's cookies from the
database and refreshing the global HeadersManager so subsequent requests carry
valid authentication data.
"""

from typing import Optional

from src.services.headers_manager import get_headers_manager


async def sync_headers_for_user(user_id: Optional[int]) -> dict:
    """Load cookies for a given user_id from DB into memory and refresh headers.

    Returns a simple dict indicating the operation result for debugging purposes.
    """
    manager = get_headers_manager()
    try:
        if user_id is not None:
            # Load cookies from DB into in-memory store
            result = await manager.cookie_manager.load_from_db(user_id)
            # Refresh global headers to include the loaded cookies
            await manager.refresh()
            loaded = result.get('loaded_count', 0) if isinstance(result, dict) else 0
            return {
                "success": True,
                "message": "Cookies loaded from DB and headers refreshed",
                "loaded_count": loaded
            }
    except Exception as e:
        # Do not propagate to avoid breaking login flow; return a debug message
        return {
            "success": False,
            "message": f"Failed to sync headers: {e}"
        }
    return {
        "success": True,
        "message": "No user_id provided or nothing to sync"
    }
