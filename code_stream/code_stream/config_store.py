"""
Configuration storage for Code Stream extension.
Stores per-user teacher server configuration securely.
"""

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from jupyter_core.paths import jupyter_data_dir


class ConfigStore:
    """
    Secure storage for teacher server configuration.
    Stores configuration per-user in Jupyter data directory with restricted permissions.
    """

    def __init__(self):
        """Initialize the config store with secure directory."""
        self.config_dir = Path(jupyter_data_dir()) / "code_stream"
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Set directory permissions to 700 (owner read/write/execute only)
        try:
            os.chmod(self.config_dir, 0o700)
        except Exception as e:
            print(f"Warning: Could not set directory permissions: {e}")

    def _get_config_path(self, user_id: str) -> Path:
        """
        Get the config file path for a specific user.

        Args:
            user_id: User identifier

        Returns:
            Path to user's config file
        """
        # Sanitize user_id to prevent directory traversal
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('_', '-'))
        return self.config_dir / f"config_{safe_user_id}.json"

    def get_config(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve configuration for a user.

        Args:
            user_id: User identifier

        Returns:
            Configuration dictionary or None if not found
        """
        config_path = self._get_config_path(user_id)

        if not config_path.exists():
            return None

        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            return config
        except Exception as e:
            print(f"Error reading config for user {user_id}: {e}")
            return None

    def set_config(self, user_id: str, config: Dict[str, Any]) -> bool:
        """
        Store configuration for a user.

        Args:
            user_id: User identifier
            config: Configuration dictionary containing:
                - teacher_base_url: str (required)
                - teacher_token: str | None (optional)
                - updated_at: int (timestamp)

        Returns:
            True if successful, False otherwise
        """
        config_path = self._get_config_path(user_id)

        try:
            # Write config file
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)

            # Set file permissions to 600 (owner read/write only)
            os.chmod(config_path, 0o600)

            print(f"Saved config for user {user_id}")
            return True
        except Exception as e:
            print(f"Error saving config for user {user_id}: {e}")
            return False

    def delete_config(self, user_id: str) -> bool:
        """
        Delete configuration for a user.

        Args:
            user_id: User identifier

        Returns:
            True if successful, False otherwise
        """
        config_path = self._get_config_path(user_id)

        if not config_path.exists():
            return True  # Already deleted

        try:
            config_path.unlink()
            print(f"Deleted config for user {user_id}")
            return True
        except Exception as e:
            print(f"Error deleting config for user {user_id}: {e}")
            return False

    def get_teacher_url(self, user_id: str) -> Optional[str]:
        """
        Get just the teacher base URL for a user.

        Args:
            user_id: User identifier

        Returns:
            Teacher base URL or None
        """
        config = self.get_config(user_id)
        return config.get('teacher_base_url') if config else None

    def get_teacher_token(self, user_id: str) -> Optional[str]:
        """
        Get the teacher token for a user.

        Args:
            user_id: User identifier

        Returns:
            Teacher token or None
        """
        config = self.get_config(user_id)
        return config.get('teacher_token') if config else None

    def has_config(self, user_id: str) -> bool:
        """
        Check if user has a configuration stored.

        Args:
            user_id: User identifier

        Returns:
            True if config exists, False otherwise
        """
        config_path = self._get_config_path(user_id)
        return config_path.exists()


# Global instance
config_store = ConfigStore()
