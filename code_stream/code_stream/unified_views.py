"""
Unified handlers for Code Stream extension.
Auto-detects teacher/student mode and routes requests appropriately.
- Teacher mode: Direct Redis access
- Student mode: Proxy to teacher server
"""

import json
from urllib.parse import urlencode
from jupyter_server.base.handlers import APIHandler
import tornado
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from .config_store import config_store
from .redis_client import redis_client


class UnifiedGetAllCellIDsHandler(APIHandler):
    """
    Unified handler for get-all-cell-ids endpoint.
    Auto-detects mode based on teacher config presence.
    """

    @tornado.web.authenticated
    async def get(self):
        """
        Get all cell IDs - auto-detects teacher/student mode.

        Teacher mode (no config): Query Redis directly
        Student mode (has config): Proxy to teacher server

        Returns:
            {"status": "success", "data": [...]} or error response
        """
        user_id = self.current_user
        config = config_store.get_config(user_id)

        # Student mode: Proxy to teacher server if config exists
        if config and config.get("teacher_base_url"):
            await self._handle_student_mode(config)
        else:
            # Teacher mode: Direct Redis access
            await self._handle_teacher_mode()

    async def _handle_teacher_mode(self):
        """Teacher mode: Query Redis directly."""
        try:
            cell_ids = await redis_client.get_all_cell_ids()
            print("Code Stream (Teacher): Get all cell IDs success:", cell_ids)
            self.finish({"status": "success", "data": cell_ids})
        except Exception as e:
            print(f"Code Stream (Teacher): Error getting cell IDs from Redis: {e}")
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to retrieve cell IDs from Redis"
            })

    async def _handle_student_mode(self, config: dict):
        """Student mode: Proxy request to teacher server."""
        teacher_base_url = config.get("teacher_base_url")
        teacher_token = config.get("teacher_token")

        # Build proxy URL
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
                self.finish(data)
            except json.JSONDecodeError:
                self.set_status(502)
                self.finish({
                    "status": "error",
                    "message": "Invalid response from teacher server"
                })

        except HTTPError as e:
            self._handle_http_error(e)

        except Exception as e:
            self._handle_network_error(e)

    def _handle_http_error(self, error: HTTPError):
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

    def _handle_network_error(self, error: Exception):
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

    async def _handle_teacher_mode(self, session_hash: str, cell_id: str, cell_timestamp: str):
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

            print("Code Stream (Teacher): Cell get success:", cell_data)
            self.finish({"status": "success", "data": cell_data})

        except Exception as e:
            print(f"Code Stream (Teacher): Error getting cell from Redis: {e}")
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to retrieve cell from Redis"
            })

    async def _handle_student_mode(self, session_hash: str, cell_id: str, cell_timestamp: str, config: dict):
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
                self.finish(data)
            except json.JSONDecodeError:
                self.set_status(502)
                self.finish({
                    "status": "error",
                    "message": "Invalid response from teacher server"
                })

        except HTTPError as e:
            self._handle_http_error(e)

        except Exception as e:
            self._handle_network_error(e)

    def _handle_http_error(self, error: HTTPError):
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

    def _handle_network_error(self, error: Exception):
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
