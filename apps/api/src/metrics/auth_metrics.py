class AuthMetrics:
    # Global counters for cookies sync stage
    total_sync_attempts: int = 0
    successful_syncs: int = 0
    failed_syncs: int = 0
    # keep a sliding window of last loaded counts for diagnostics
    loaded_counts: list = []

    @classmethod
    def record_attempt(cls, user_id: int, success: bool, loaded_count: int) -> None:
        cls.total_sync_attempts += 1
        if success:
            cls.successful_syncs += 1
        else:
            cls.failed_syncs += 1
        try:
            cls.loaded_counts.append(int(loaded_count))
        except Exception:
            pass
        # cap history length to last 100 entries to avoid unbounded growth
        if len(cls.loaded_counts) > 100:
            cls.loaded_counts = cls.loaded_counts[-100:]

    @classmethod
    def to_dict(cls) -> dict:
        return {
            "total_sync_attempts": cls.total_sync_attempts,
            "successful_syncs": cls.successful_syncs,
            "failed_syncs": cls.failed_syncs,
            "loaded_counts": cls.loaded_counts,
        }
