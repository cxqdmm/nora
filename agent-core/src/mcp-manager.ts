import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface ToolDef {
  name: string;
  description?: string;
  inputSchema?: any;
}

export class MCPManager {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private serverName: string;

  constructor(serverName: string = "mcp-server") {
    this.serverName = serverName;
    this.client = new Client(
      {
        name: `agent-client-${serverName}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(command: string, args: string[]) {
    console.log(`[MCP:${this.serverName}] Connecting...`);
    this.transport = new StdioClientTransport({
      command,
      args,
    });

    await this.client.connect(this.transport);
    console.log(`[MCP:${this.serverName}] Connected`);
  }

  async listTools() {
    return await this.client.listTools();
  }

  async callTool(name: string, args: any) {
    return await this.client.callTool({
      name,
      arguments: args,
    });
  }

  async close() {
    if (this.transport) {
      await this.transport.close();
    }
  }
}
