import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

from .redis_views import PushCellHandler, GetCellHandler, UpdateCellHandler, DeleteCellHandler, GetAllCellIDsHandler
from .config_views import ConfigHandler, TestConnectionHandler
from .unified_views import UnifiedGetAllCellIDsHandler, UnifiedGetCellHandler


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /code-stream/get-example endpoint!"
        }))




def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Teacher endpoints (write operations to Redis)
    add_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/push-cell/")
    update_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/update/")
    delete_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/delete/")

    # Configuration endpoints (for students to set teacher server URL)
    config_endpoint = url_path_join(base_url, r"/code_stream/config")
    test_endpoint = url_path_join(base_url, r"/code_stream/test")

    # Proxy endpoints (student reads proxied to teacher server)
    proxy_get_all_cell_ids = url_path_join(base_url, r"/code_stream/get-all-cell-ids/")
    proxy_get_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/get-cell/")

    # Example endpoint
    route_pattern = url_path_join(base_url, "code-stream", "get-example")

    handlers = [
        (route_pattern, RouteHandler),
        # Teacher endpoints (direct Redis write operations)
        (add_cell, PushCellHandler),
        (update_cell, UpdateCellHandler),
        (delete_cell, DeleteCellHandler),
        # Configuration endpoints
        (config_endpoint, ConfigHandler),
        (test_endpoint, TestConnectionHandler),
        # Unified endpoints (auto-detect teacher/student mode for read operations)
        (proxy_get_all_cell_ids, UnifiedGetAllCellIDsHandler),
        (proxy_get_cell, UnifiedGetCellHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
