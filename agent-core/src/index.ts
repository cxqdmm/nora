import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";
import readline from 'readline';
import { MCPManager } from './mcp-manager.js';
import { LLMService, LLMProvider } from './llm-service.js';
import { Agent } from './agent.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server Configs
const pythonServerPath = path.resolve(__dirname, "../../mcp-servers/python-sandbox/server.py");
const memoryServicePath = path.resolve(__dirname, "../../mcp-servers/memory-service/dist/index.js");
const allowedDir = path.resolve(__dirname, "../../workspace"); // Create a safe workspace dir

function parseArgs(): { provider: LLMProvider } {
  const args = process.argv.slice(2);
  let provider: LLMProvider = 'qwen'; // Default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      const p = args[i + 1].toLowerCase();
      if (p === 'qwen' || p === 'zhipu') {
        provider = p as LLMProvider;
      } else {
        console.warn(`Unknown provider '${p}', using default 'qwen'. Supported: qwen, zhipu`);
      }
      i++;
    }
  }
  return { provider };
}

async function main() {
  console.log('================================================');
  console.log('       Nora Agent System - Interactive CLI      ');
  console.log('================================================');
  
  const { provider } = parseArgs();
  console.log(`[Config] Selected LLM Provider: ${provider.toUpperCase()}`);

  // 1. Initialize Services
  const llm = new LLMService(provider);

  // 2. Initialize MCP Managers
  const sandboxMcp = new MCPManager("python-sandbox");
  const fsMcp = new MCPManager("filesystem");
  const memoryMcp = new MCPManager("memory-service");

  try {
    // 3. Connect to Servers
    await sandboxMcp.connect("python3", [pythonServerPath]);
    
    // Connect to FS Server
    await import('fs').then(fs => fs.promises.mkdir(allowedDir, { recursive: true }));
    console.log(`[Setup] Filesystem workspace: ${allowedDir}`);
    await fsMcp.connect("npx", ["-y", "@modelcontextprotocol/server-filesystem", allowedDir]);

    // Connect to Memory Service
    await memoryMcp.connect("node", [memoryServicePath]);

    // 4. Initialize Agent with ALL MCPs
    const agent = new Agent([sandboxMcp, fsMcp, memoryMcp], llm);
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
          await memoryMcp.close();
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
