import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

from .redis_views import PushCellHandler, GetCellHandler, UpdateCellHandler, DeleteCellHandler, GetAllCellIDsHandler


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    # @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /code-stream/get-example endpoint!"
        }))




def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    add_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/push-cell/")
    get_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/get-cell/")
    update_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/update/")
    delete_cell = url_path_join(base_url, r"/code_stream/([a-zA-Z0-9]{6})/delete/")
    get_all_cell_ids = url_path_join(base_url, r"/code_stream/get-all-cell-ids/")


    route_pattern = url_path_join(base_url, "code-stream", "get-example")
    handlers = [
        (route_pattern, RouteHandler),
        (add_cell, PushCellHandler),
        (get_cell, GetCellHandler),
        (update_cell, UpdateCellHandler),
        (delete_cell, DeleteCellHandler),
        (get_all_cell_ids, GetAllCellIDsHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
