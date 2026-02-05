import chalk from 'chalk';
import { LogServer } from './log-server.js';

export class Logger {
  private static logServer: LogServer | null = null;

  static setLogServer(server: LogServer) {
    this.logServer = server;
  }

  private static broadcast(log: any) {
    if (this.logServer) {
      this.logServer.broadcast(log);
    }
  }

  static info(prefix: string, message: string) {
    console.log(`${chalk.blue.bold(`[${prefix}]`)} ${message}`);
    this.broadcast({ type: 'info', prefix, message });
  }

  static phase(phaseName: string) {
    console.log(chalk.blue.bold(`\n=== Phase: ${phaseName} ===`));
    this.broadcast({ type: 'phase', message: `=== Phase: ${phaseName} ===` });
  }

  static turn(count: number, status: string) {
    console.log(chalk.cyan.bold(`\n--- Turn ${count}: ${status} ---`));
    this.broadcast({ type: 'turn', message: `--- Turn ${count}: ${status} ---` });
  }

  static toolCall(toolName: string, args: any) {
    console.log(`${chalk.magenta.bold(`[Tool]`)} ${chalk.green.bold(toolName)} ${chalk.gray(JSON.stringify(args))}`);
    this.broadcast({ type: 'tool', name: toolName, args });
  }

  static plan(reasoning: string) {
    console.log(`${chalk.yellow.bold(`[Plan]`)} ${chalk.italic(reasoning)}`);
    this.broadcast({ type: 'plan', message: reasoning });
  }

  static step(id: number, description: string) {
    console.log(`  ${chalk.yellow.bold(`[Step ${id}]`)} ${description}`);
    this.broadcast({ type: 'step', id, message: description });
  }

  static success(prefix: string, message: string) {
    console.log(`${chalk.green.bold(`[${prefix}]`)} ${message}`);
    this.broadcast({ type: 'success', prefix, message });
  }

  static warn(prefix: string, message: string) {
    console.log(`${chalk.yellow.bold(`[${prefix}]`)} ${message}`);
    this.broadcast({ type: 'warn', prefix, message });
  }

  static error(prefix: string, message: string) {
    console.error(`${chalk.red.bold(`[${prefix}]`)} ${message}`);
    this.broadcast({ type: 'error', prefix, message });
  }

  static llmMessage(role: string, content: string) {
    const roleColor = role === 'user' ? chalk.cyan : role === 'assistant' ? chalk.green : role === 'system' ? chalk.gray : chalk.magenta;
    const truncated = content.length > 60 ? content.substring(0, 60) + chalk.gray('...') : content;
    const cleanContent = truncated.replace(/\n/g, ' '); // Inline newlines
    console.log(`  ${roleColor(role.padEnd(10))} ${cleanContent}`);
    // this.broadcast({ type: 'llm', role, message: content }); // Deprecated in favor of llmInput
  }

  static llmInput(messages: any[]) {
    console.log(`${chalk.magenta.bold(`[LLM]`)} Input Messages: ${messages.length}`);
    this.broadcast({ type: 'llm-input', messages });
  }

  static code(code: string) {
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.yellow(code.trim()));
    console.log(chalk.gray('─'.repeat(50)));
    this.broadcast({ type: 'code', message: code });
  }

  static toolOutput(content: string) {
    const truncated = content.trim().length > 200 
      ? content.trim().substring(0, 200) + chalk.gray('... (truncated)') 
      : content.trim();
    console.log(chalk.dim(truncated));
    this.broadcast({ type: 'info', prefix: 'ToolOutput', message: content });
  }
}
