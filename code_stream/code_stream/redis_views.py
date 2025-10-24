from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from .redis_client import redis_client

'''
CRUD API Handlers for managing code cells in Redis.
Authentication is enabled for all endpoints.
'''

class PushCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        cell_content = str(data.get("cell_content"))
        cell_timestamp = str(data.get("cell_timestamp"))
        cell_id = str(data.get("cell_id"))

        # Push the cell content to the Redis list for the specified channel
        
        await redis_client.add_cell(session_hash=session_hash, cell_id=cell_id, cell_data=cell_content, timestamp=cell_timestamp)
        print("Cell push success:", cell_content, cell_timestamp, cell_id)
        self.finish({"status": "success", "message": "Cell content pushed to channel."})
    

class GetCellHandler(APIHandler):
    @tornado.web.authenticated
    async def get(self, session_hash: str):
        cell_id = self.get_query_argument("cell_id", None)
        cell_timestamp = self.get_query_argument("cell_timestamp", None)

        if cell_id is None or cell_timestamp is None:
            self.set_status(400)
            self.finish({"status": "error", "message": "Missing cell_id or cell_timestamp parameter."})
            return

        cell_data = await redis_client.get_cell(session_hash=session_hash, cell_id=cell_id, cell_timestamp=cell_timestamp)

        if cell_data is None:
            self.set_status(404)
            self.finish({"status": "error", "message": "Cell not found."})
            return
        print("Cell get success:", cell_data)
        self.finish({"status": "success", "data": cell_data})

class UpdateCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        cell_content = str(data.get("cell_content"))
        cell_timestamp = str(data.get("cell_timestamp"))
        cell_id = str(data.get("cell_id"))

        # Update the cell content in the Redis list for the specified channel
        success = await redis_client.update_cell(session_hash=session_hash, cell_id=cell_id, cell_data=cell_content, timestamp=cell_timestamp)

        if not success:
            self.set_status(404)
            self.finish({"status": "error", "message": "Cell not found for update."})
            return
        print("Cell update success:", cell_content, cell_timestamp, cell_id)
        self.finish({"status": "success", "message": "Cell content updated in channel."})


class DeleteCellHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return
        cell_timestamp = str(data.get("cell_timestamp"))
        cell_id = str(data.get("cell_id"))

        # Delete the cell content in the Redis list for the specified channel
        success = await redis_client.delete_cell(session_hash=session_hash, cell_id=cell_id, cell_timestamp=cell_timestamp)

        if not success:
            self.set_status(404)
            self.finish({"status": "error", "message": "Cell not found for deletion."})
            return
        print("Cell delete success:", cell_timestamp, cell_id)
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
        print(f"Get all cell IDs success (session={session_hash_param}):", cell_ids)
        self.finish({"status": "success", "data": cell_ids})
