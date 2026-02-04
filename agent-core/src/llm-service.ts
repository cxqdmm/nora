import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Logger } from './logger.js';

dotenv.config();

export type LLMProvider = 'qwen' | 'zhipu';

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
      modelName = process.env.ZHIPU_MODEL_NAME || "glm-4";
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

  async chat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], tools?: OpenAI.Chat.Completions.ChatCompletionTool[]) {
    // Log messages
    Logger.info("LLM", "Input Messages:");
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: tools,
        tool_choice: tools ? "auto" : undefined,
      });

      return response.choices[0].message;
    } catch (error: any) {
      Logger.error("LLM", `Chat Error: ${error.message}`);
      throw error;
    }
  }
}
