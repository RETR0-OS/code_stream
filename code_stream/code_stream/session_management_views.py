from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from .redis_client import redis_client

'''
Session Management API Handlers for clearing Redis and cleaning up orphan cells.
Authentication is enabled for all endpoints.
'''

class ClearAllRedisHandler(APIHandler):
    """
    Handler to clear all Redis data.
    Used when creating a new session or refreshing session code.
    """
    @tornado.web.authenticated
    async def post(self):
        try:
            deleted_count = await redis_client.clear_all_data()
            print(f"Redis cleared successfully. Deleted {deleted_count} keys.")
            self.finish({
                "status": "success",
                "message": f"All Redis data cleared. {deleted_count} keys deleted.",
                "deleted_count": deleted_count
            })
        except Exception as e:
            print(f"Error clearing Redis: {e}")
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": f"Failed to clear Redis: {str(e)}"
            })


class CleanupOrphanCellsHandler(APIHandler):
    """
    Handler to clean up orphan cells that exist in Redis but not in the notebook.
    """
    @tornado.web.authenticated
    async def post(self, session_hash: str):
        data = self.get_json_body()

        if data is None:
            self.set_status(400)
            self.finish({"status": "error", "message": "Invalid JSON body."})
            return

        valid_cell_ids = data.get("valid_cell_ids", [])

        if not isinstance(valid_cell_ids, list):
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": "valid_cell_ids must be a list."
            })
            return

        try:
            deleted_count = await redis_client.cleanup_orphan_cells(
                session_hash=session_hash,
                valid_cell_ids=valid_cell_ids
            )
            print(f"Orphan cells cleanup success for session {session_hash}. Deleted {deleted_count} orphan cells.")
            self.finish({
                "status": "success",
                "message": f"Orphan cells cleaned up. {deleted_count} cells deleted.",
                "deleted_count": deleted_count
            })
        except Exception as e:
            print(f"Error cleaning up orphan cells: {e}")
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": f"Failed to clean up orphan cells: {str(e)}"
            })
