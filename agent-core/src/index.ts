import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";
import readline from 'readline';
import { MCPManager } from './mcp-manager.js';
import { LLMService, LLMProvider } from './llm-service.js';
import { Agent } from './agent.js';
import { LogServer } from './log-server.js';
import { Logger } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server Configs
const pythonServerPath = path.resolve(__dirname, "../../mcp-servers/python-sandbox/server.py");
const isWin = process.platform === 'win32';
const venvPythonWin = path.resolve(__dirname, "../../mcp-servers/python-sandbox/.venv/Scripts/python.exe");
const venvPythonUnix = path.resolve(__dirname, "../../mcp-servers/python-sandbox/.venv/bin/python");
const memoryServicePath = path.resolve(__dirname, "../../mcp-servers/memory-service/src/index.ts");
const skillsServicePath = path.resolve(__dirname, "../../mcp-servers/skills-service/src/index.ts");
const allowedDir = path.resolve(__dirname, "../../");

function parseArgs(): { provider: LLMProvider } {
  const args = process.argv.slice(2);
  let provider: LLMProvider = 'qwen'; // Default

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--provider' || args[i] === '--p') && args[i + 1]) {
      const p = args[i + 1].toLowerCase();
      if (p === 'qwen' || p === 'zhipu' || p === 'kimi' || p === 'openrouter') {
        provider = p as LLMProvider;
      } else {
        console.warn(`Unknown provider '${p}', using default 'qwen'. Supported: qwen, zhipu, kimi, openrouter`);
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
  
  // Initialize Log Server
  const logServer = new LogServer(3000);
  Logger.setLogServer(logServer);
  console.log(`[LogView] Open public/viewer.html in your browser to see live logs.`);

  // 2. Initialize MCP Managers
  const sandboxMcp = new MCPManager("python-sandbox");
  const fsMcp = new MCPManager("filesystem");
  const memoryMcp = new MCPManager("memory-service");
  const skillsMcp = new MCPManager("skills-service");

  try {
    // 3. Connect to Servers
    let pythonCmd = "python3";
    let pythonArgs: string[] = [pythonServerPath];
    try {
      const fs = await import('fs');
      if (isWin && fs.existsSync(venvPythonWin)) {
        pythonCmd = venvPythonWin;
      } else if (!isWin && fs.existsSync(venvPythonUnix)) {
        pythonCmd = venvPythonUnix;
      } else if (isWin) {
        pythonCmd = "python";
      }
    } catch {}
    await sandboxMcp.connect(pythonCmd, pythonArgs);
    
    // Connect to FS Server
    await import('fs').then(fs => fs.promises.mkdir(allowedDir, { recursive: true }));
    console.log(`[Setup] Filesystem workspace: ${allowedDir}`);
    await fsMcp.connect("npx", ["-y", "@modelcontextprotocol/server-filesystem", allowedDir]);

    // Connect to Memory Service
    await memoryMcp.connect("npx", ["-y", "tsx", memoryServicePath]);

    // Connect to Skills Service
    await skillsMcp.connect("npx", ["-y", "tsx", skillsServicePath]);

    // 4. Initialize Agent with ALL MCPs
    const agent = new Agent([sandboxMcp, fsMcp, memoryMcp, skillsMcp], llm);
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
          logServer.close();
          process.exit(0);
        }

        try {
          const response = await agent.chat(input);
          Logger.finalAnswer(response);
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
