import chalk from 'chalk';

export class Logger {
  static info(prefix: string, message: string) {
    console.log(`${chalk.blue.bold(`[${prefix}]`)} ${message}`);
  }

  static success(prefix: string, message: string) {
    console.log(`${chalk.green.bold(`[${prefix}]`)} ${message}`);
  }

  static warn(prefix: string, message: string) {
    console.log(`${chalk.yellow.bold(`[${prefix}]`)} ${message}`);
  }

  static error(prefix: string, message: string) {
    console.error(`${chalk.red.bold(`[${prefix}]`)} ${message}`);
  }

  static llmMessage(role: string, content: string) {
    const roleColor = role === 'user' ? chalk.cyan : role === 'assistant' ? chalk.green : role === 'system' ? chalk.gray : chalk.magenta;
    const truncated = content.length > 60 ? content.substring(0, 60) + chalk.gray('...') : content;
    const cleanContent = truncated.replace(/\n/g, ' '); // Inline newlines
    console.log(`  ${roleColor(role.padEnd(10))} ${cleanContent}`);
  }

  static code(code: string) {
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.yellow(code.trim()));
    console.log(chalk.gray('─'.repeat(50)));
  }

  static toolOutput(content: string) {
    const truncated = content.trim().length > 200 
      ? content.trim().substring(0, 200) + chalk.gray('... (truncated)') 
      : content.trim();
    console.log(chalk.dim(truncated));
  }
}
