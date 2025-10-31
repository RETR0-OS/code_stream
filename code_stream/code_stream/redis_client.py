import json
from datetime import datetime
from hashlib import md5
from typing import List, Optional, Any, Dict
import redis.asyncio as async_redis


class RedisClient:

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0,):

        self.client = async_redis.Redis(host=host, port=port, db=db)

    
    def create_key(self, session_hash: str, cell_id: str, timestamp: str) -> str:
        # New session-prefixed key format for efficient session-scoped queries
        # Format: cs:{session_hash}:{cell_id_hash}
        cell_id_hash = md5(cell_id.encode()).hexdigest()
        return f"cs:{session_hash}:{cell_id_hash}"
    
    def create_legacy_key(self, session_hash: str, cell_id: str, timestamp: str) -> str:
        # Legacy key format for backward compatibility reads
        combined = f"{session_hash}:{cell_id}"
        return md5(combined.encode()).hexdigest()
    
    async def add_cell(self, session_hash: str, cell_id: str, cell_data: str, timestamp: str) -> bool:
        try:
            key = self.create_key(session_hash, cell_id, timestamp)

            data = {
                "cell_id": cell_id,
                "timestamp": timestamp,
                "data": cell_data
            }

            await self.client.hset(key, mapping=data)

            return True
        except Exception as e:
            print(f"Error adding cell: {e}")
            return False
    
    async def get_cell(self, session_hash: str, cell_id: str, cell_timestamp: str) -> Optional[str]:
        try:
            # Try new key format first
            key = self.create_key(session_hash, cell_id, cell_timestamp)
            data = await self.client.hgetall(key)
            
            # Fall back to legacy key if not found
            if not data:
                legacy_key = self.create_legacy_key(session_hash, cell_id, cell_timestamp)
                data = await self.client.hgetall(legacy_key)
            
            if not data:
                return None
            # Redis returns bytes, decode to string
            return data.get(b'data', b'').decode('utf-8')
        except Exception as e:
            print(f"Error retrieving cell: {e}")
            return None
        
    async def delete_cell(self, session_hash: str, cell_id: str, cell_timestamp: str) -> bool:
        try:
            # Try new key format first
            key = self.create_key(session_hash, cell_id, cell_timestamp)
            result = await self.client.delete(key)
            
            # If not found, try legacy key
            if result == 0:
                legacy_key = self.create_legacy_key(session_hash, cell_id, cell_timestamp)
                result = await self.client.delete(legacy_key)
            
            return result >= 1
        except Exception as e:
            print(f"Error deleting cell: {e}")
            return False
    
    async def update_cell(self, session_hash: str, cell_id: str, cell_data: str, timestamp: str) -> bool:
        try:
            key = self.create_key(session_hash, cell_id, timestamp)
            exists = await self.client.exists(key)
            
            # Check legacy key if new key doesn't exist
            if not exists:
                legacy_key = self.create_legacy_key(session_hash, cell_id, timestamp)
                exists = await self.client.exists(legacy_key)
                # If legacy key exists, migrate to new format
                if exists:
                    key = self.create_key(session_hash, cell_id, timestamp)
            
            if not exists:
                result = await self.add_cell(session_hash, cell_id, cell_data, timestamp)
                return result
            
            await self.client.hset(key, mapping={"data": cell_data, "timestamp": timestamp})
            return True
        except Exception as e:
            print(f"Error updating cell: {e}")
            return False
    
    async def get_all_cell_ids(self, session_hash: Optional[str] = None) -> List[str]:
        """
        Get all cell IDs, optionally filtered by session.

        Args:
            session_hash: If provided, return only cell IDs for this session.
                         If None, return all cell IDs (legacy behavior).

        Returns:
            List of unique cell IDs
        """
        try:
            if session_hash:
                # Session-scoped query using new key format
                pattern = f"cs:{session_hash}:*"
            else:
                # Global query for backward compatibility
                pattern = '*'

            keys = await self.client.keys(pattern)
            cell_ids = set()

            for key in keys:
                data = await self.client.hgetall(key)
                cell_id = data.get(b'cell_id', b'').decode('utf-8')
                if cell_id:
                    cell_ids.add(cell_id)

            return list(cell_ids)
        except Exception as e:
            print(f"Error retrieving all cell IDs: {e}")
            return []

    async def clear_all_data(self) -> int:
        """
        Clear all data from Redis database.
        Used when creating a new session or refreshing session code.

        Returns:
            Number of keys deleted (or 1 for success)
        """
        try:
            # Get count of keys before clearing (for reporting)
            keys_count = await self.client.dbsize()
            # Clear entire database
            await self.client.flushdb()
            return keys_count
        except Exception as e:
            print(f"Error clearing Redis data: {e}")
            return 0

    async def cleanup_orphan_cells(self, session_hash: str, valid_cell_ids: List[str]) -> int:
        """
        Delete cells from Redis that are not in the provided list of valid cell IDs.
        This removes orphan cells that were deleted from the notebook but still exist in Redis.

        Args:
            session_hash: The session hash to clean up
            valid_cell_ids: List of cell IDs that currently exist in the notebook

        Returns:
            Number of orphan cells deleted
        """
        try:
            pattern = f"cs:{session_hash}:*"
            keys = await self.client.keys(pattern)
            deleted_count = 0

            for key in keys:
                data = await self.client.hgetall(key)
                cell_id = data.get(b'cell_id', b'').decode('utf-8')

                # If cell_id is not in the valid list, delete it
                if cell_id and cell_id not in valid_cell_ids:
                    result = await self.client.delete(key)
                    if result >= 1:
                        deleted_count += 1

            return deleted_count
        except Exception as e:
            print(f"Error cleaning up orphan cells: {e}")
            return 0


redis_client = RedisClient()
        

