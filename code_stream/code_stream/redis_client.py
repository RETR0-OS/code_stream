import json
from datetime import datetime
from hashlib import md5
from typing import Optional, Any, Dict
import redis.asyncio as async_redis


class RedisClient:

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0,):

        self.client = async_redis.Redis(host=host, port=port, db=db)

    
    def create_key(self, cell_id:str, timestamp:str) -> str:
        return md5(cell_id.encode()).hexdigest()

    
    async def add_cell(self, cell_id: str, cell_data: str, timestamp: str) -> bool:
        try:
            key = self.create_key(cell_id, timestamp)
            
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
    
    async def get_cell(self, cell_id: str, cell_timestamp: str) -> Optional[Dict[str, Any]]:
        try:
            key_pattern = self.create_key(cell_id, cell_timestamp)
            data = await self.client.hget(key_pattern)
            return data
        except Exception as e:
            print(f"Error retrieving cell: {e}")
            return None
        
    async def delete_cell(self, cell_id: str, cell_timestamp: str) -> bool:
        try:
            key_pattern = self.create_key(cell_id, cell_timestamp)
            result = await self.client.delete(key_pattern)
            return result == 1
        except Exception as e:
            print(f"Error deleting cell: {e}")
            return False
    
    async def update_cell(self, cell_id: str, cell_timestamp: str, new_data: str) -> bool:
        try:
            key_pattern = self.create_key(cell_id, cell_timestamp)
            exists = await self.client.exists(key_pattern)
            if not exists:
                result = await self.add_cell(cell_id, new_data, cell_timestamp)
                return result
            await self.client.hset(key_pattern, mapping={"data": new_data})
            return True
        except Exception as e:
            print(f"Error updating cell: {e}")
            return False

redis_client = RedisClient()
        

