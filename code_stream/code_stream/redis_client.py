import json
from datetime import datetime
from hashlib import md5
from typing import Optional, Any, Dict
import redis.asyncio as async_redis


class RedisClient:

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0,):

        self.client = async_redis.Redis(host=host, port=port, db=db)

    
    def create_key(self, session_hash: str, cell_id: str, timestamp: str) -> str:
        # Include session_hash in key for session isolation
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
            key_pattern = self.create_key(session_hash, cell_id, cell_timestamp)
            data = await self.client.hgetall(key_pattern)
            if not data:
                return None
            # Redis returns bytes, decode to string
            return data.get(b'data', b'').decode('utf-8')
        except Exception as e:
            print(f"Error retrieving cell: {e}")
            return None
        
    async def delete_cell(self, session_hash: str, cell_id: str, cell_timestamp: str) -> bool:
        try:
            key_pattern = self.create_key(session_hash, cell_id, cell_timestamp)
            result = await self.client.delete(key_pattern)
            return result == 1
        except Exception as e:
            print(f"Error deleting cell: {e}")
            return False
    
    async def update_cell(self, session_hash: str, cell_id: str, cell_data: str, timestamp: str) -> bool:
        try:
            key_pattern = self.create_key(session_hash, cell_id, timestamp)
            exists = await self.client.exists(key_pattern)
            if not exists:
                result = await self.add_cell(session_hash, cell_id, cell_data, timestamp)
                return result
            await self.client.hset(key_pattern, mapping={"data": cell_data, "timestamp": timestamp})
            return True
        except Exception as e:
            print(f"Error updating cell: {e}")
            return False

redis_client = RedisClient()
        

