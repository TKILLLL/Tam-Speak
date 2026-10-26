export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAIProviderStrategy {
  readonly providerId: string;
  readonly modelName: string;

  generateChatCompletion(params: {
    systemPrompt: string;
    messages: ChatMessagePayload[];
    apiKey: string;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<string>;
}
