import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class MCPManager {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: "agent-core",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect(serverPath: string) {
    console.log(`Connecting to MCP Server at ${serverPath}...`);
    this.transport = new StdioClientTransport({
      command: "python3",
      args: [serverPath],
    });

    await this.client.connect(this.transport);
    console.log("Connected to MCP Server");
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
