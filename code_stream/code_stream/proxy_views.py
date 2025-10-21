"""
Proxy handlers for Code Stream extension.
Student servers proxy GET requests to teacher's Jupyter server.
"""

import json
from urllib.parse import urlencode
from jupyter_server.base.handlers import APIHandler
import tornado
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from .config_store import config_store


class ProxyGetAllCellIDsHandler(APIHandler):
    """Proxy handler for get-all-cell-ids endpoint."""

    @tornado.web.authenticated
    async def get(self):
        """
        Proxy GET request to teacher server for all cell IDs.

        Returns:
            {"status": "success", "data": [...]} or error response
        """
        user_id = self.current_user

        # Load teacher server config
        config = config_store.get_config(user_id)

        if not config:
            self.set_status(428)  # Precondition Required
            self.finish({
                "status": "error",
                "message": "Teacher server not configured. Please configure teacher server URL in the sidebar."
            })
            return

        teacher_base_url = config.get("teacher_base_url")
        teacher_token = config.get("teacher_token")

        if not teacher_base_url:
            self.set_status(428)
            self.finish({
                "status": "error",
                "message": "Teacher base URL is missing from configuration"
            })
            return

        # Build proxy URL
        proxy_url = f"{teacher_base_url}/code_stream/get-all-cell-ids/"

        # Build request headers
        headers = {}
        if teacher_token:
            # Send token as Authorization header
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
        elif error.code == 428:
            self.set_status(428)
            self.finish({
                "status": "error",
                "message": "Teacher server requires configuration. Please contact your teacher."
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


class ProxyGetCellHandler(APIHandler):
    """Proxy handler for get-cell endpoint."""

    @tornado.web.authenticated
    async def get(self, session_hash: str):
        """
        Proxy GET request to teacher server for specific cell.

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

        # Load teacher server config
        config = config_store.get_config(user_id)

        if not config:
            self.set_status(428)  # Precondition Required
            self.finish({
                "status": "error",
                "message": "Teacher server not configured. Please configure teacher server URL in the sidebar."
            })
            return

        teacher_base_url = config.get("teacher_base_url")
        teacher_token = config.get("teacher_token")

        if not teacher_base_url:
            self.set_status(428)
            self.finish({
                "status": "error",
                "message": "Teacher base URL is missing from configuration"
            })
            return

        # Build proxy URL with query parameters
        query_params = urlencode({
            'cell_id': cell_id,
            'cell_timestamp': cell_timestamp
        })
        proxy_url = f"{teacher_base_url}/code_stream/{session_hash}/get-cell/?{query_params}"

        # Build request headers
        headers = {}
        if teacher_token:
            # Send token as Authorization header
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
        elif error.code == 428:
            self.set_status(428)
            self.finish({
                "status": "error",
                "message": "Teacher server requires configuration. Please contact your teacher."
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
