import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";
import readline from 'readline';
import { MCPManager } from './mcp-manager.js';
import { LLMService } from './llm-service.js';
import { Agent } from './agent.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server Configs
const pythonServerPath = path.resolve(__dirname, "../../mcp-servers/python-sandbox/server.py");
const allowedDir = path.resolve(__dirname, "../../workspace"); // Create a safe workspace dir

async function main() {
  console.log('================================================');
  console.log('       Nora Agent System - Interactive CLI      ');
  console.log('================================================');
  
  // 1. Initialize Services
  const llm = new LLMService();

  // 2. Initialize MCP Managers
  const sandboxMcp = new MCPManager("python-sandbox");
  const fsMcp = new MCPManager("filesystem");

  try {
    // 3. Connect to Servers
    await sandboxMcp.connect("python3", [pythonServerPath]);
    
    // Connect to FS Server (using npx)
    // Note: We need to ensure the workspace directory exists
    await import('fs').then(fs => fs.promises.mkdir(allowedDir, { recursive: true }));
    console.log(`[Setup] Filesystem workspace: ${allowedDir}`);
    
    await fsMcp.connect("npx", ["-y", "@modelcontextprotocol/server-filesystem", allowedDir]);

    // 4. Initialize Agent with ALL MCPs
    const agent = new Agent([sandboxMcp, fsMcp], llm);
    await agent.initialize();

    // 5. Setup Interactive Loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('\nUser (type "exit" to quit): ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          rl.close();
          await sandboxMcp.close();
          await fsMcp.close();
          process.exit(0);
        }

        try {
          const response = await agent.chat(input);
          console.log(`\nAgent: ${response}`);
        } catch (error) {
          console.error("Error processing request:", error);
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (err) {
    console.error("Fatal Initialization Error:", err);
    process.exit(1);
  }
}

main().catch(console.error);
