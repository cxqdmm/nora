import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Path Configuration
// This server runs in mcp-servers/memory-service
const SERVICE_ROOT = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(SERVICE_ROOT, "scripts");

// Define where memory files are stored (Project Root / memorys)
const PROJECT_ROOT = path.resolve(SERVICE_ROOT, "../..");
const DEFAULT_MEMORY_DIR = path.join(PROJECT_ROOT, "memorys");

const server = new Server(
  {
    name: "memory-service",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tools Definition
const TOOLS = {
  SEARCH_MEMORIES: "search_memories",
  READ_MEMORY: "read_memory",
  STORE_MEMORY: "store_memory",
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: TOOLS.SEARCH_MEMORIES,
        description: "Search long-term memory summaries using keywords. Returns a list of relevant memory summaries.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keywords to filter memories (e.g., 'react performance', 'auth bug')",
            },
            limit: {
              type: "number",
              description: "Max number of results to return (default: all)",
            },
          },
        },
      },
      {
        name: TOOLS.READ_MEMORY,
        description: "Read the full content of a specific memory by ID or path.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique ID of the memory (e.g., '20260203151532_k7n9hl')",
            },
            path: {
              type: "string",
              description: "Relative path to the memory file (alternative to ID)",
            },
          },
        },
      },
      {
        name: TOOLS.STORE_MEMORY,
        description: "Store a new long-term memory. Use this to save valuable insights, decisions, or bug fixes.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "A short, descriptive title for the memory.",
            },
            description: {
              type: "string",
              description: "A 1-3 sentence summary of the memory.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Keywords for categorization.",
            },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Related file paths in the repository.",
            },
            type: {
              type: "string",
              description: "Type of memory: 'bugfix', 'decision', 'skill', 'rule' (default: 'memory')",
            },
            importance: {
              type: "number",
              description: "Importance level (1-10, default: 5)",
            },
            body: {
              type: "string",
              description: "The full detailed content of the memory (Markdown format).",
            },
          },
          required: ["name", "body"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure MEMORY_BASE_DIR is set for the child process
  const env = { ...process.env, MEMORY_BASE_DIR: DEFAULT_MEMORY_DIR };

  try {
    switch (name) {
      case TOOLS.SEARCH_MEMORIES: {
        const query = String(args?.query || "");
        const limit = args?.limit ? Number(args.limit) : "";
        
        const cmdArgs = [];
        if (query) cmdArgs.push(`--query "${query.replace(/"/g, '\\"')}"`);
        if (limit) cmdArgs.push(`--limit ${limit}`);
        
        const command = `node ${path.join(SCRIPTS_DIR, "memory_search.js")} ${cmdArgs.join(" ")}`;
        console.error(`[MemoryService] Executing: ${command}`);
        
        const { stdout } = await execAsync(command, { cwd: SERVICE_ROOT, env });
        return {
          content: [{ type: "text", text: stdout }],
        };
      }

      case TOOLS.READ_MEMORY: {
        const id = args?.id ? String(args.id) : "";
        const relPath = args?.path ? String(args.path) : "";

        if (!id && !relPath) {
          throw new Error("Either 'id' or 'path' must be provided.");
        }

        const cmdArgs = [];
        if (id) cmdArgs.push(`--id "${id}"`);
        if (relPath) cmdArgs.push(`--path "${relPath}"`);

        const command = `node ${path.join(SCRIPTS_DIR, "memory_get.js")} ${cmdArgs.join(" ")}`;
        console.error(`[MemoryService] Executing: ${command}`);

        const { stdout } = await execAsync(command, { cwd: SERVICE_ROOT, env });
        return {
          content: [{ type: "text", text: stdout }],
        };
      }

      case TOOLS.STORE_MEMORY: {
        const name = String(args?.name || "");
        const body = String(args?.body || "");
        const description = args?.description ? String(args.description) : "";
        const type = args?.type ? String(args.type) : "memory";
        const importance = args?.importance ? Number(args.importance) : 5;
        const tags = Array.isArray(args?.tags) ? args.tags.join(",") : "";
        const files = Array.isArray(args?.files) ? args.files.join(",") : "";

        const cmdArgs = [
          `--name "${name.replace(/"/g, '\\"')}"`,
          `--type "${type}"`,
          `--importance ${importance}`
        ];
        
        if (description) cmdArgs.push(`--description "${description.replace(/"/g, '\\"')}"`);
        if (tags) cmdArgs.push(`--tags "${tags}"`);
        if (files) cmdArgs.push(`--files "${files}"`);

        const scriptPath = path.join(SCRIPTS_DIR, "memory_store.js");
        const command = `node ${scriptPath} ${cmdArgs.join(" ")}`;
        
        console.error(`[MemoryService] Executing store command...`);
        
        const { exec } = await import("child_process");
        
        return new Promise((resolve, reject) => {
          const child = exec(command, { cwd: SERVICE_ROOT, env }, (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`Failed to store memory: ${stderr || error.message}`));
              return;
            }
            resolve({
              content: [{ type: "text", text: stdout }],
            });
          });
          
          if (child.stdin) {
            child.stdin.write(body);
            child.stdin.end();
          }
        });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Memory Service MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
