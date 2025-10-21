"""
Configuration API handlers for Code Stream extension.
Handles teacher server configuration (URL and token) for students.
"""

import json
import time
from urllib.parse import urlparse
from jupyter_server.base.handlers import APIHandler
import tornado
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from .config_store import config_store


class ConfigHandler(APIHandler):
    """Handler for getting and setting teacher server configuration."""

    @tornado.web.authenticated
    async def get(self):
        """
        Get current teacher server configuration (masked for security).

        Returns:
            {
                "status": "success",
                "data": {
                    "teacher_base_url": "http://...",
                    "has_token": boolean
                }
            }
        """
        user_id = self.current_user

        config = config_store.get_config(user_id)

        if not config:
            self.finish({
                "status": "success",
                "data": {
                    "teacher_base_url": None,
                    "has_token": False
                }
            })
            return

        # Return masked config (never expose token)
        self.finish({
            "status": "success",
            "data": {
                "teacher_base_url": config.get("teacher_base_url"),
                "has_token": bool(config.get("teacher_token"))
            }
        })

    @tornado.web.authenticated
    async def post(self):
        """
        Set teacher server configuration.

        Request body:
            {
                "teacher_base_url": "http://192.168.1.10:8888",
                "teacher_token": "optional-token-string"
            }

        Returns:
            {"status": "success" | "error", "message": "..."}
        """
        user_id = self.current_user

        try:
            data = self.get_json_body()
        except Exception:
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": "Invalid JSON body"
            })
            return

        if data is None:
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": "Request body is required"
            })
            return

        teacher_base_url = data.get("teacher_base_url")
        teacher_token = data.get("teacher_token")

        # Validate teacher_base_url
        if not teacher_base_url:
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": "teacher_base_url is required"
            })
            return

        # Validate URL format
        validation_error = self._validate_url(teacher_base_url)
        if validation_error:
            self.set_status(400)
            self.finish({
                "status": "error",
                "message": validation_error
            })
            return

        # Normalize URL (remove trailing slash)
        teacher_base_url = teacher_base_url.rstrip('/')

        # Store configuration
        config = {
            "teacher_base_url": teacher_base_url,
            "teacher_token": teacher_token if teacher_token else None,
            "updated_at": int(time.time())
        }

        success = config_store.set_config(user_id, config)

        if success:
            self.finish({
                "status": "success",
                "message": "Configuration saved successfully"
            })
        else:
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to save configuration"
            })

    @tornado.web.authenticated
    async def delete(self):
        """
        Delete teacher server configuration.

        Returns:
            {"status": "success" | "error", "message": "..."}
        """
        user_id = self.current_user

        success = config_store.delete_config(user_id)

        if success:
            self.finish({
                "status": "success",
                "message": "Configuration deleted successfully"
            })
        else:
            self.set_status(500)
            self.finish({
                "status": "error",
                "message": "Failed to delete configuration"
            })

    def _validate_url(self, url: str) -> str | None:
        """
        Validate teacher server URL.

        Args:
            url: URL to validate

        Returns:
            Error message if invalid, None if valid
        """
        try:
            parsed = urlparse(url)

            # Must be http or https
            if parsed.scheme not in ('http', 'https'):
                return "URL must use http:// or https:// scheme"

            # Must have a hostname
            if not parsed.hostname:
                return "URL must include a hostname"

            # Must not contain credentials in URL
            if parsed.username or parsed.password:
                return "URL must not contain embedded credentials (user:pass@host)"

            return None

        except Exception as e:
            return f"Invalid URL format: {str(e)}"


class TestConnectionHandler(APIHandler):
    """Handler for testing connection to teacher server."""

    @tornado.web.authenticated
    async def post(self):
        """
        Test connection to teacher server by making a proxy request.

        Returns:
            {"status": "success" | "error", "message": "..."}
        """
        user_id = self.current_user

        # Get teacher server config
        config = config_store.get_config(user_id)

        if not config:
            self.set_status(428)  # Precondition Required
            self.finish({
                "status": "error",
                "message": "Teacher server not configured. Please configure teacher server URL first."
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

        # Test connection by making a simple request to get-all-cell-ids endpoint
        test_url = f"{teacher_base_url}/code_stream/get-all-cell-ids/"

        # Build request with optional token
        headers = {}
        if teacher_token:
            headers['Authorization'] = f'token {teacher_token}'

        try:
            http_client = AsyncHTTPClient()
            request = HTTPRequest(
                url=test_url,
                method='GET',
                headers=headers,
                connect_timeout=5.0,
                request_timeout=15.0
            )

            response = await http_client.fetch(request)

            # Check if response is valid
            if response.code == 200:
                self.finish({
                    "status": "success",
                    "message": "Connection to teacher server successful"
                })
            else:
                self.finish({
                    "status": "error",
                    "message": f"Teacher server returned status code {response.code}"
                })

        except HTTPError as e:
            if e.code == 401:
                self.finish({
                    "status": "error",
                    "message": "Authentication failed. Please check your token."
                })
            elif e.code == 403:
                self.finish({
                    "status": "error",
                    "message": "Access forbidden. Please check your token permissions."
                })
            elif e.code == 404:
                self.finish({
                    "status": "error",
                    "message": "Teacher server endpoint not found. Please verify the URL."
                })
            else:
                self.finish({
                    "status": "error",
                    "message": f"HTTP error {e.code}: {str(e)}"
                })

        except Exception as e:
            error_message = str(e)

            if "Timeout" in error_message or "timed out" in error_message:
                self.finish({
                    "status": "error",
                    "message": "Connection timeout. Please check if teacher server is accessible."
                })
            elif "Connection refused" in error_message:
                self.finish({
                    "status": "error",
                    "message": "Connection refused. Please verify teacher server is running and accessible."
                })
            else:
                self.finish({
                    "status": "error",
                    "message": f"Connection error: {error_message}"
                })
