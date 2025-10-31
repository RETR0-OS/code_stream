import logging
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from .redis_client import redis_client

logger = logging.getLogger(__name__)

'''
CRUD API Handlers for managing code cells in Redis.
Authentication is enabled for all endpoints.
'''

class PushCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            logger.warning("Push cell request with invalid JSON body")
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        
        cell_content = str(data.get("cell_content", ""))
        cell_timestamp = str(data.get("cell_timestamp", ""))
        cell_id = str(data.get("cell_id", ""))
        
        # Validate required fields
        if not cell_id or not cell_timestamp:
            logger.warning(f"Push cell request missing required fields: cell_id={cell_id}, timestamp={cell_timestamp}")
            self.set_status(400)
            self.finish({"status": "error", "message": "Missing required fields: cell_id and cell_timestamp."})
            return

        # Push the cell content to the Redis list for the specified channel
        success = await redis_client.add_cell(
            session_hash=session_hash, 
            cell_id=cell_id, 
            cell_data=cell_content, 
            timestamp=cell_timestamp
        )
        
        if success:
            logger.info(f"Cell {cell_id} pushed to session {session_hash}")
            self.finish({"status": "success", "message": "Cell content pushed to channel."})
        else:
            logger.error(f"Failed to push cell {cell_id} to session {session_hash}")
            self.set_status(500)
            self.finish({"status": "error", "message": "Failed to push cell to Redis."})
    

class GetCellHandler(APIHandler):
    @tornado.web.authenticated
    async def get(self, session_hash: str):
        cell_id = self.get_query_argument("cell_id", None)
        cell_timestamp = self.get_query_argument("cell_timestamp", None)

        if cell_id is None or cell_timestamp is None:
            logger.warning("Get cell request missing required parameters")
            self.set_status(400)
            self.finish({"status": "error", "message": "Missing cell_id or cell_timestamp parameter."})
            return

        cell_data = await redis_client.get_cell(
            session_hash=session_hash, 
            cell_id=cell_id, 
            cell_timestamp=cell_timestamp
        )

        if cell_data is None:
            self.set_status(404)
            self.finish({"status": "error", "message": "Cell not found."})
            return
        
        logger.debug(f"Cell {cell_id} retrieved from session {session_hash}")
        self.finish({"status": "success", "data": cell_data})

class UpdateCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            logger.warning("Update cell request with invalid JSON body")
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        
        cell_content = str(data.get("cell_content", ""))
        cell_timestamp = str(data.get("cell_timestamp", ""))
        cell_id = str(data.get("cell_id", ""))
        
        # Validate required fields
        if not cell_id or not cell_timestamp:
            logger.warning(f"Update cell request missing required fields: cell_id={cell_id}, timestamp={cell_timestamp}")
            self.set_status(400)
            self.finish({"status": "error", "message": "Missing required fields: cell_id and cell_timestamp."})
            return

        # Update the cell content in the Redis list for the specified channel
        success = await redis_client.update_cell(
            session_hash=session_hash, 
            cell_id=cell_id, 
            cell_data=cell_content, 
            timestamp=cell_timestamp
        )

        if not success:
            logger.error(f"Failed to update cell {cell_id} in session {session_hash}")
            self.set_status(500)
            self.finish({"status": "error", "message": "Failed to update cell in Redis."})
            return
        
        logger.info(f"Cell {cell_id} updated in session {session_hash}")
        self.finish({"status": "success", "message": "Cell content updated in channel."})


class DeleteCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            logger.warning("Delete cell request with invalid JSON body")
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        
        cell_timestamp = str(data.get("cell_timestamp", ""))
        cell_id = str(data.get("cell_id", ""))
        
        # Validate required fields
        if not cell_id or not cell_timestamp:
            logger.warning(f"Delete cell request missing required fields: cell_id={cell_id}, timestamp={cell_timestamp}")
            self.set_status(400)
            self.finish({"status": "error", "message": "Missing required fields: cell_id and cell_timestamp."})
            return

        # Delete the cell content in the Redis list for the specified channel
        success = await redis_client.delete_cell(
            session_hash=session_hash, 
            cell_id=cell_id, 
            cell_timestamp=cell_timestamp
        )

        if not success:
            logger.warning(f"Cell {cell_id} not found for deletion in session {session_hash}")
            self.set_status(404)
            self.finish({"status": "error", "message": "Cell not found for deletion."})
            return
        
        logger.info(f"Cell {cell_id} deleted from session {session_hash}")
        self.finish({"status": "success", "message": "Cell content deleted from channel."})

class GetAllCellIDsHandler(APIHandler):
    """
    Legacy handler for getting all cell IDs.
    NOTE: This is no longer used - UnifiedGetAllCellIDsHandler is used instead.
    Kept for backward compatibility if directly imported.
    """
    @tornado.web.authenticated
    async def get(self, session_hash: str = ""):
        # Support optional session hash
        session_hash_param = session_hash if session_hash else None
        cell_ids = await redis_client.get_all_cell_ids(session_hash_param)
        logger.debug(f"Get all cell IDs success (session={session_hash_param}): {len(cell_ids)} cells")
        self.finish({"status": "success", "data": cell_ids})
