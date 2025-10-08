from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from .redis_client import redis_client

'''
Temporary disabling authentication for easier testing.
Remember to re-enable it before production deployment.
Todo: Add authentication back.
'''

'''
CRUD API Handlers for managing code cells in Redis.
'''

class PushCellHandler(APIHandler):
    # @tornado.web.authenticated
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
    # @tornado.web.authenticated
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
    # @tornado.web.authenticated
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
    # @tornado.web.authenticated
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
    # @tornado.web.authenticated
    async def get(self):
        cell_ids = await redis_client.get_all_cell_ids()
        print("Get all cell IDs success:", cell_ids)
        self.finish({"status": "success", "data": cell_ids})
