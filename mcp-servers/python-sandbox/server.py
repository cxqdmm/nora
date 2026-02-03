import sys
import json
import logging
import traceback
import io
from contextlib import redirect_stdout, redirect_stderr
from typing import Any, Dict, Optional

# Logging setup
logging.basicConfig(level=logging.INFO, stream=sys.stderr, format='[%(levelname)s] %(message)s')
logger = logging.getLogger("python-sandbox")

class MCPServer:
    def __init__(self):
        self.tools = {}

    def register_tool(self, name, description, input_schema, func):
        self.tools[name] = {
            "name": name,
            "description": description,
            "inputSchema": input_schema,
            "func": func
        }

    def run(self):
        logger.info("MCP Server starting...")
        for line in sys.stdin:
            try:
                line = line.strip()
                if not line:
                    continue
                request = json.loads(line)
                self.handle_request(request)
            except Exception as e:
                logger.error(f"Error handling line: {e}")
                # traceback.print_exc(file=sys.stderr)

    def handle_request(self, request: Dict[str, Any]):
        msg_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})

        if method == "initialize":
            self.send_response(msg_id, {
                "protocolVersion": "2024-11-05", 
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "python-sandbox",
                    "version": "1.0.0"
                }
            })
        elif method == "notifications/initialized":
            logger.info("Client initialized")
        elif method == "tools/list":
            tools_list = []
            for t in self.tools.values():
                tools_list.append({
                    "name": t["name"],
                    "description": t["description"],
                    "inputSchema": t["inputSchema"]
                })
            self.send_response(msg_id, {"tools": tools_list})
        elif method == "tools/call":
            name = params.get("name")
            args = params.get("arguments", {})
            if name in self.tools:
                try:
                    # Check if args is string and parse it if necessary (some clients might send stringified json)
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except:
                            pass # Assume it's just a string argument if single? No, arguments should be object.
                            
                    result = self.tools[name]["func"](**args)
                    self.send_response(msg_id, {
                        "content": [
                            {"type": "text", "text": str(result)}
                        ]
                    })
                except Exception as e:
                    logger.error(f"Error executing tool {name}: {e}")
                    traceback.print_exc(file=sys.stderr)
                    self.send_error(msg_id, -32603, str(e))
            else:
                self.send_error(msg_id, -32601, f"Tool {name} not found")
        elif method == "ping":
             self.send_response(msg_id, {})
        else:
            # For notifications (no id), just ignore
            if msg_id is not None:
                # self.send_error(msg_id, -32601, f"Method {method} not found")
                # Fallback for unknown methods - maybe log but don't crash
                logger.warning(f"Unknown method: {method}")

    def send_response(self, msg_id, result):
        response = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": result
        }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

    def send_error(self, msg_id, code, message):
        response = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {
                "code": code,
                "message": message
            }
        }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

# Tool implementations
def execute_code(code: str):
    logger.info(f"Executing code length: {len(code)}")
    
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    result_globals = {}
    
    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code, result_globals)
        
        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()
        
        return f"Output:\n{output}\nErrors:\n{errors}"
    except Exception as e:
        return f"Execution Error: {str(e)}"

if __name__ == "__main__":
    server = MCPServer()
    server.register_tool(
        "execute_code",
        "Execute Python code in a sandbox. Returns stdout/stderr.",
        {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "The python code to execute"}
            },
            "required": ["code"]
        },
        execute_code
    )
    server.run()
