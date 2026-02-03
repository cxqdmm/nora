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
const pythonServerPath = path.resolve(__dirname, "../../mcp-servers/python-sandbox/server.py");

async function main() {
  console.log('================================================');
  console.log('       Nora Agent System - Interactive CLI      ');
  console.log('================================================');
  
  const mcp = new MCPManager();
  const llm = new LLMService();
  const agent = new Agent(mcp, llm);
  
  try {
    // Connect and Initialize
    await mcp.connect(pythonServerPath);
    await agent.initialize();

    // Setup Readline Interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('\nUser (type "exit" to quit): ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          rl.close();
          // await mcp.close();
          process.exit(0);
        }

        try {
          const response = await agent.chat(input);
          console.log(`\nAgent: ${response}`);
        } catch (error) {
          console.error("Error processing request:", error);
        }

        // Recursive call for next question
        askQuestion();
      });
    };

    // Start Loop
    askQuestion();

  } catch (err) {
    console.error("Fatal Initialization Error:", err);
    process.exit(1);
  }
}

main().catch(console.error);
