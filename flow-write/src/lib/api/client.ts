/**
 * OpenAI-Compatible LLM Client
 *
 * A single client implementation that works with any OpenAI-compatible API endpoint.
 * This includes OpenAI, DeepSeek, local LLM servers, and other compatible services.
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  ChatMessage,
  UsageInfo
} from './types';
import type {
  ApiConfiguration
} from '../core/apiconfig';
import {
  getSystemPromptContent,
  getUserPromptContent
} from '../core/apiconfig';

// ============================================================================
// Client Configuration
// ============================================================================

export interface ClientConfig {
  /** API endpoint URL (e.g., "https://api.openai.com/v1") */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
}

// ============================================================================
// OpenAI-Compatible Client
// ============================================================================

export class OpenAICompatibleClient {
  private endpoint: string;
  private apiKey: string;

  constructor(config: ClientConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private get headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  /**
   * Create a non-streaming chat completion
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ...request, stream: false })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message ?? `API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a streaming chat completion
   */
  async *chatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ...request, stream: true })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message ?? `API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.slice(6)) as StreamChunk;
            yield chunk;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

// ============================================================================
// Request Builder
// ============================================================================

/**
 * Build a ChatCompletionRequest from ApiConfiguration
 */
export function buildRequestFromConfig(config: ApiConfiguration): ChatCompletionRequest {
  const messages: ChatMessage[] = [];

  const systemContent = getSystemPromptContent(config);
  if (systemContent.trim()) {
    messages.push({ role: 'system', content: systemContent });
  }

  const userContent = getUserPromptContent(config);
  if (userContent.trim()) {
    messages.push({ role: 'user', content: userContent });
  }

  return {
    model: config.connection.model,
    messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    presence_penalty: config.parameters.presencePenalty,
    frequency_penalty: config.parameters.frequencyPenalty,
    stop: config.parameters.stopSequences.length > 0
      ? config.parameters.stopSequences
      : undefined,
    stream: config.parameters.streaming
  };
}

/**
 * Build a ChatCompletionRequest from messages and options
 */
export function buildChatRequest(
  messages: ChatMessage[],
  model: string,
  options: Partial<ChatCompletionRequest> = {}
): ChatCompletionRequest {
  return {
    model,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
    ...options
  };
}

// ============================================================================
// Response Parsers
// ============================================================================

export function extractContent(response: ChatCompletionResponse): string {
  return response.choices[0]?.message.content ?? '';
}

export function extractUsage(response: ChatCompletionResponse): UsageInfo {
  return response.usage;
}

export function extractStreamContent(chunk: StreamChunk): string {
  return chunk.choices[0]?.delta.content ?? '';
}

// ============================================================================
// Streaming Helper
// ============================================================================

export interface StreamHandlerOptions {
  onContent?: (content: string) => void;
  onUsage?: (usage: UsageInfo) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export async function handleStream(
  stream: AsyncGenerator<StreamChunk, void, unknown>,
  options: StreamHandlerOptions
): Promise<string> {
  let content = '';
  try {
    for await (const chunk of stream) {
      const text = extractStreamContent(chunk);
      if (text) {
        content += text;
        options.onContent?.(text);
      }
      if (chunk.usage) {
        options.onUsage?.(chunk.usage);
      }
    }
    options.onComplete?.();
  } catch (err) {
    options.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
  return content;
}
