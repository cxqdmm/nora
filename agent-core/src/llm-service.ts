import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Logger } from './logger.js';

dotenv.config();

export type LLMProvider = 'qwen' | 'zhipu' | 'kimi' | 'openrouter';

export class LLMService {
  private client: OpenAI;
  private model: string;
  private provider: LLMProvider;

  constructor(provider: LLMProvider = 'qwen') {
    this.provider = provider;
    let apiKey: string | undefined;
    let baseURL: string | undefined;
    let modelName: string | undefined;

    if (provider === 'qwen') {
      apiKey = process.env.QWEN_API_KEY;
      baseURL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
      modelName = process.env.QWEN_MODEL_NAME || "qwen-plus";
    } else if (provider === 'zhipu') {
      apiKey = process.env.ZHIPU_API_KEY;
      baseURL = process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/";
      modelName = process.env.ZHIPU_MODEL_NAME || "glm-4.7";
    } else if (provider === 'kimi') {
      apiKey = process.env.KIMI_API_KEY;
      baseURL = process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1";
      modelName = process.env.KIMI_MODEL_NAME || "kimi-k2.5";
    } else if (provider === 'openrouter') {
      apiKey = process.env.OPENROUTER_API_KEY;
      baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
      modelName = process.env.OPENROUTER_MODEL_NAME || "moonshotai/kimi-k2.5";
    }

    if (!apiKey) {
      throw new Error(`API Key for provider '${provider}' is not set.`);
    }

    this.model = modelName!;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
    
    Logger.info("LLM", `Initialized with provider: ${provider}, model: ${this.model}`);
  }

  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], 
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption,
    source: string = 'Unknown'
  ) {
    // Log messages
    Logger.llmInput(messages);
    
    // Console log for debugging (truncated)
    messages.forEach((msg) => {
      let contentPreview = "";
      if (typeof msg.content === 'string') {
        contentPreview = msg.content;
      } else if (Array.isArray(msg.content)) {
        contentPreview = "[Complex Content]";
      }
      Logger.llmMessage(msg.role, contentPreview);
    });

    try {
      const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: this.model,
        messages: messages,
        tools: tools,
        tool_choice: toolChoice ? toolChoice : (tools ? "auto" : undefined),
      };

      if (this.provider === 'openrouter') {
        // OpenRouter often needs explicit max_tokens to avoid "credit limit" errors
        // assuming "you requested X tokens" refers to context window reservation
        (options as any).max_tokens = 8192; 
      }

      const response = await this.client.chat.completions.create(options);

      if (response.usage) {
        Logger.llmUsage(response.usage, source);
      }

      return response.choices[0].message;
    } catch (error: any) {
      Logger.error("LLM", `Chat Error: ${error.message}`);
      throw error;
    }
  }
}
