"""
Unified handlers for Code Stream extension.
Auto-detects teacher/student mode and routes requests appropriately.
- Teacher mode: Direct Redis access
- Student mode: Proxy to teacher server
"""

import json
import logging
from typing import Optional
from urllib.parse import urlencode
from jupyter_server.base.handlers import APIHandler
import tornado
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from .config_store import config_store
from .redis_client import redis_client

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)


class UnifiedGetAllCellIDsHandler(APIHandler):
    """
    Unified handler for get-all-cell-ids endpoint.
    Auto-detects mode based on teacher config presence.
    Supports both session-scoped and global queries.
    """

    @tornado.web.authenticated
    async def get(self, session_hash: str = ""):
        """
        Get all cell IDs - auto-detects teacher/student mode.

        Teacher mode (no config): Query Redis directly
        Student mode (has config): Proxy to teacher server

        Args:
            session_hash: Optional session hash for session-scoped queries

        Returns:
            {"status": "success", "data": [...]} or error response
        """
        user_id = self.current_user
        config = config_store.get_config(user_id)

        # Convert empty string to None for optional parameter
        session_hash_param = session_hash if session_hash else None

        # Student mode: Proxy to teacher server if config exists
        if config and config.get("teacher_base_url"):
            await self._handle_student_mode(config, session_hash_param)
        else:
            # Teacher mode: Direct Redis access
            await self._handle_teacher_mode(session_hash_param)

    async def _handle_teacher_mode(self, session_hash: Optional[str] = None) -> None:
        """Teacher mode: Query Redis directly."""
        try:
            cell_ids = await redis_client.get_all_cell_ids(session_hash)
            logger.info(f"Code Stream (Teacher): Retrieved {len(cell_ids)} cell IDs (session={session_hash})")
            self.finish({"status": "success", "data": cell_ids})
        except Exception as e:
            logger.error(f"Code Stream (Teacher): Error getting cell IDs from Redis: {e}", exc_info=True)
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to retrieve cell IDs from Redis"
            })

    async def _handle_student_mode(self, config: dict, session_hash: Optional[str] = None) -> None:
        """Student mode: Proxy request to teacher server."""
        teacher_base_url = config.get("teacher_base_url")
        teacher_token = config.get("teacher_token")

        # Build proxy URL with optional session hash
        if session_hash:
            proxy_url = f"{teacher_base_url}/code_stream/{session_hash}/get-all-cell-ids/"
        else:
            proxy_url = f"{teacher_base_url}/code_stream/get-all-cell-ids/"

        # Build request headers
        headers = {}
        if teacher_token:
            headers['Authorization'] = f'token {teacher_token}'

        try:
            http_client = AsyncHTTPClient()
            request = HTTPRequest(
                url=proxy_url,
                method='GET',
                headers=headers,
                connect_timeout=5.0,
                request_timeout=15.0
            )

            response = await http_client.fetch(request)

            # Parse and return response
            try:
                data = json.loads(response.body)
                logger.info(f"Code Stream (Student): Successfully proxied get-all-cell-ids to teacher server")
                self.finish(data)
            except json.JSONDecodeError as e:
                logger.error(f"Code Stream (Student): Invalid JSON response from teacher server: {e}")
                self.set_status(502)
                self.finish({
                    "status": "error",
                    "message": "Invalid response from teacher server"
                })

        except HTTPError as e:
            logger.warning(f"Code Stream (Student): HTTP error from teacher server: {e.code}")
            self._handle_http_error(e)

        except Exception as e:
            logger.error(f"Code Stream (Student): Network error connecting to teacher server: {e}")
            self._handle_network_error(e)

    def _handle_http_error(self, error: HTTPError) -> None:
        """Handle HTTP errors from teacher server."""
        if error.code == 401:
            self.set_status(401)
            self.finish({
                "status": "error",
                "message": "Authentication failed with teacher server. Please check your token."
            })
        elif error.code == 403:
            self.set_status(403)
            self.finish({
                "status": "error",
                "message": "Access forbidden by teacher server. Please check your permissions."
            })
        elif error.code == 404:
            self.set_status(404)
            self.finish({
                "status": "error",
                "message": "Teacher server endpoint not found. Please verify the configuration."
            })
        else:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": f"Teacher server error (HTTP {error.code})"
            })

    def _handle_network_error(self, error: Exception) -> None:
        """Handle network errors."""
        error_message = str(error)

        if "Timeout" in error_message or "timed out" in error_message:
            self.set_status(504)
            self.finish({
                "status": "error",
                "message": "Connection to teacher server timed out. Please try again later."
            })
        elif "Connection refused" in error_message:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": "Cannot connect to teacher server. Please check if it is running."
            })
        else:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": f"Network error: {error_message}"
            })


class UnifiedGetCellHandler(APIHandler):
    """
    Unified handler for get-cell endpoint.
    Auto-detects mode based on teacher config presence.
    """

    @tornado.web.authenticated
    async def get(self, session_hash: str):
        """
        Get cell content - auto-detects teacher/student mode.

        Teacher mode (no config): Query Redis directly
        Student mode (has config): Proxy to teacher server

        Args:
            session_hash: Session hash (6-character code)

        Query parameters:
            cell_id: Cell identifier
            cell_timestamp: Cell timestamp

        Returns:
            {"status": "success", "data": "..."} or error response
        """
        user_id = self.current_user

        # Get query parameters
        cell_id = self.get_query_argument("cell_id", None)
        cell_timestamp = self.get_query_argument("cell_timestamp", None)

        if cell_id is None or cell_timestamp is None:
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": "Missing cell_id or cell_timestamp parameter"
            })
            return

        config = config_store.get_config(user_id)

        # Student mode: Proxy to teacher server if config exists
        if config and config.get("teacher_base_url"):
            await self._handle_student_mode(session_hash, cell_id, cell_timestamp, config)
        else:
            # Teacher mode: Direct Redis access
            await self._handle_teacher_mode(session_hash, cell_id, cell_timestamp)

    async def _handle_teacher_mode(self, session_hash: str, cell_id: str, cell_timestamp: str) -> None:
        """Teacher mode: Query Redis directly."""
        try:
            cell_data = await redis_client.get_cell(
                session_hash=session_hash,
                cell_id=cell_id,
                cell_timestamp=cell_timestamp
            )

            if cell_data is None:
                self.set_status(404)
                self.finish({"status": "error", "message": "Cell not found."})
                return

            logger.info(f"Code Stream (Teacher): Retrieved cell {cell_id} from session {session_hash}")
            self.finish({"status": "success", "data": cell_data})

        except Exception as e:
            logger.error(f"Code Stream (Teacher): Error getting cell from Redis: {e}", exc_info=True)
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to retrieve cell from Redis"
            })

    async def _handle_student_mode(self, session_hash: str, cell_id: str, cell_timestamp: str, config: dict) -> None:
        """Student mode: Proxy request to teacher server."""
        teacher_base_url = config.get("teacher_base_url")
        teacher_token = config.get("teacher_token")

        # Build proxy URL with query parameters
        query_params = urlencode({
            'cell_id': cell_id,
            'cell_timestamp': cell_timestamp
        })
        proxy_url = f"{teacher_base_url}/code_stream/{session_hash}/get-cell/?{query_params}"

        # Build request headers
        headers = {}
        if teacher_token:
            headers['Authorization'] = f'token {teacher_token}'

        try:
            http_client = AsyncHTTPClient()
            request = HTTPRequest(
                url=proxy_url,
                method='GET',
                headers=headers,
                connect_timeout=5.0,
                request_timeout=15.0
            )

            response = await http_client.fetch(request)

            # Parse and return response
            try:
                data = json.loads(response.body)
                logger.info(f"Code Stream (Student): Successfully proxied get-cell to teacher server")
                self.finish(data)
            except json.JSONDecodeError as e:
                logger.error(f"Code Stream (Student): Invalid JSON response from teacher server: {e}")
                self.set_status(502)
                self.finish({
                    "status": "error",
                    "message": "Invalid response from teacher server"
                })

        except HTTPError as e:
            logger.warning(f"Code Stream (Student): HTTP error from teacher server: {e.code}")
            self._handle_http_error(e)

        except Exception as e:
            logger.error(f"Code Stream (Student): Network error connecting to teacher server: {e}")
            self._handle_network_error(e)

    def _handle_http_error(self, error: HTTPError) -> None:
        """Handle HTTP errors from teacher server."""
        if error.code == 401:
            self.set_status(401)
            self.finish({
                "status": "error",
                "message": "Authentication failed with teacher server. Please check your token."
            })
        elif error.code == 403:
            self.set_status(403)
            self.finish({
                "status": "error",
                "message": "Access forbidden by teacher server. Please check your permissions."
            })
        elif error.code == 404:
            self.set_status(404)
            self.finish({
                "status": "error",
                "message": "Cell not found on teacher server."
            })
        else:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": f"Teacher server error (HTTP {error.code})"
            })

    def _handle_network_error(self, error: Exception) -> None:
        """Handle network errors."""
        error_message = str(error)

        if "Timeout" in error_message or "timed out" in error_message:
            self.set_status(504)
            self.finish({
                "status": "error",
                "message": "Connection to teacher server timed out. Please try again later."
            })
        elif "Connection refused" in error_message:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": "Cannot connect to teacher server. Please check if it is running."
            })
        else:
            self.set_status(502)
            self.finish({
                "status": "error",
                "message": f"Network error: {error_message}"
            })
