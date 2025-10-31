import json
import logging
from datetime import datetime
from hashlib import md5
from typing import List, Optional, Any, Dict
import redis.asyncio as async_redis

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

class RedisClient:
    """
    Redis client with connection pooling and proper error handling.
    
    This client uses connection pooling for better performance and
    implements SCAN instead of KEYS for production-safe operations.
    """

    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0, max_connections: int = 10):
        """
        Initialize Redis client with connection pooling.
        
        Args:
            host: Redis server hostname
            port: Redis server port
            db: Redis database number
            max_connections: Maximum number of connections in the pool
        """
        # Create connection pool for better performance
        self.pool = async_redis.ConnectionPool(
            host=host,
            port=port,
            db=db,
            max_connections=max_connections,
            decode_responses=False  # We handle decoding explicitly
        )
        self.client = async_redis.Redis(connection_pool=self.pool)

    
    def create_key(self, session_hash: str, cell_id: str, timestamp: str) -> str:
        """
        Create session-prefixed key for efficient session-scoped queries.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            timestamp: Timestamp (not used in current implementation)
            
        Returns:
            Key in format: cs:{session_hash}:{cell_id_hash}
        """
        # New session-prefixed key format for efficient session-scoped queries
        # Format: cs:{session_hash}:{cell_id_hash}
        cell_id_hash = md5(cell_id.encode()).hexdigest()
        return f"cs:{session_hash}:{cell_id_hash}"
    
    def create_legacy_key(self, session_hash: str, cell_id: str, timestamp: str) -> str:
        """
        Create legacy key format for backward compatibility.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            timestamp: Timestamp (not used in current implementation)
            
        Returns:
            MD5 hash of session:cell_id combination
        """
        # Legacy key format for backward compatibility reads
        combined = f"{session_hash}:{cell_id}"
        return md5(combined.encode()).hexdigest()
    
    async def add_cell(self, session_hash: str, cell_id: str, cell_data: str, timestamp: str) -> bool:
        """
        Add a new cell to Redis.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            cell_data: Cell content
            timestamp: Cell timestamp
            
        Returns:
            True if successful, False otherwise
        """
        try:
            key = self.create_key(session_hash, cell_id, timestamp)

            data = {
                "cell_id": cell_id,
                "timestamp": timestamp,
                "data": cell_data
            }

            await self.client.hset(key, mapping=data)
            logger.info(f"Successfully added cell {cell_id} to session {session_hash}")
            return True
        except async_redis.RedisError as e:
            logger.error(f"Redis error adding cell {cell_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error adding cell {cell_id}: {e}")
            return False
    
    async def get_cell(self, session_hash: str, cell_id: str, cell_timestamp: str) -> Optional[str]:
        """
        Retrieve cell data from Redis.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            cell_timestamp: Cell timestamp
            
        Returns:
            Cell data as string, or None if not found
        """
        try:
            # Try new key format first
            key = self.create_key(session_hash, cell_id, cell_timestamp)
            data = await self.client.hgetall(key)
            
            # Fall back to legacy key if not found
            if not data:
                legacy_key = self.create_legacy_key(session_hash, cell_id, cell_timestamp)
                data = await self.client.hgetall(legacy_key)
            
            if not data:
                logger.warning(f"Cell {cell_id} not found in session {session_hash}")
                return None
            # Redis returns bytes, decode to string
            cell_data = data.get(b'data', b'').decode('utf-8')
            logger.debug(f"Successfully retrieved cell {cell_id} from session {session_hash}")
            return cell_data
        except async_redis.RedisError as e:
            logger.error(f"Redis error retrieving cell {cell_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving cell {cell_id}: {e}")
            return None
        
    async def delete_cell(self, session_hash: str, cell_id: str, cell_timestamp: str) -> bool:
        """
        Delete cell from Redis.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            cell_timestamp: Cell timestamp
            
        Returns:
            True if cell was deleted, False otherwise
        """
        try:
            # Try new key format first
            key = self.create_key(session_hash, cell_id, cell_timestamp)
            result = await self.client.delete(key)
            
            # If not found, try legacy key
            if result == 0:
                legacy_key = self.create_legacy_key(session_hash, cell_id, cell_timestamp)
                result = await self.client.delete(legacy_key)
            
            if result >= 1:
                logger.info(f"Successfully deleted cell {cell_id} from session {session_hash}")
            else:
                logger.warning(f"Cell {cell_id} not found for deletion in session {session_hash}")
            return result >= 1
        except async_redis.RedisError as e:
            logger.error(f"Redis error deleting cell {cell_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting cell {cell_id}: {e}")
            return False
    
    async def update_cell(self, session_hash: str, cell_id: str, cell_data: str, timestamp: str) -> bool:
        """
        Update existing cell or create if it doesn't exist.
        
        Args:
            session_hash: Session identifier
            cell_id: Cell identifier
            cell_data: Updated cell content
            timestamp: Cell timestamp
            
        Returns:
            True if successful, False otherwise
        """
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
            logger.info(f"Successfully updated cell {cell_id} in session {session_hash}")
            return True
        except async_redis.RedisError as e:
            logger.error(f"Redis error updating cell {cell_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating cell {cell_id}: {e}")
            return False
    
    async def get_all_cell_ids(self, session_hash: Optional[str] = None) -> List[str]:
        """
        Get all cell IDs, optionally filtered by session.
        
        PERFORMANCE: Uses SCAN instead of KEYS for production-safe iteration.
        KEYS command blocks Redis and should never be used in production.
        
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
            
            cell_ids = set()
            
            # Use SCAN instead of KEYS for production-safe iteration
            # SCAN doesn't block Redis and is much more efficient
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=100)
                
                # Process keys in batch
                for key in keys:
                    try:
                        data = await self.client.hgetall(key)
                        cell_id = data.get(b'cell_id', b'').decode('utf-8')
                        if cell_id:
                            cell_ids.add(cell_id)
                    except Exception as e:
                        logger.warning(f"Error processing key {key}: {e}")
                        continue
                
                # SCAN returns 0 when iteration is complete
                if cursor == 0:
                    break
            
            result = list(cell_ids)
            logger.debug(f"Retrieved {len(result)} cell IDs for session={session_hash}")
            return result
            
        except async_redis.RedisError as e:
            logger.error(f"Redis error retrieving cell IDs: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error retrieving cell IDs: {e}")
            return []

    async def close(self) -> None:
        """
        Close Redis connection pool.
        
        Should be called when shutting down the application.
        """
        try:
            await self.client.close()
            await self.pool.disconnect()
            logger.info("Redis connection pool closed successfully")
        except Exception as e:
            logger.error(f"Error closing Redis connection pool: {e}")


redis_client = RedisClient()
        

