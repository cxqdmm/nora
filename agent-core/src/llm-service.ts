import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.QWEN_API_KEY;
    const baseURL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    this.model = process.env.QWEN_MODEL_NAME || "qwen-plus";

    if (!apiKey) {
      throw new Error("QWEN_API_KEY environment variable is not set.");
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
  }

  async chat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], tools?: OpenAI.Chat.Completions.ChatCompletionTool[]) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: tools,
        tool_choice: tools ? "auto" : undefined,
      });

      return response.choices[0].message;
    } catch (error) {
      console.error("LLM Chat Error:", error);
      throw error;
    }
  }
}
