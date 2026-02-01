/**
 * API Configuration System for FlowWrite (v2)
 *
 * ApiConfiguration is the core component that encapsulates all settings
 * for an LLM API call, including connection, parameters, and prompts.
 *
 * Prompts are TextBlockLists containing metadata only.
 * Runtime resolution of virtual blocks is handled in core-runner.
 */

import {
  type TextBlockList,
  type NodeId,
  createTextBlockList,
  getDependencies
} from './textblock';

// ============================================================================
// Connection Settings
// ============================================================================

/**
 * Connection settings for OpenAI-compatible endpoints
 */
export interface ApiConnection {
  /** API endpoint URL (e.g., "https://api.openai.com/v1") */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Model identifier (e.g., "gpt-4o", "deepseek-chat") */
  model: string;
}

export const defaultApiConnection: ApiConnection = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o'
};

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Request parameters for LLM generation
 */
export interface ApiParameters {
  /** Temperature for sampling (0-2) */
  temperature: number;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Nucleus sampling parameter (0-1) */
  topP: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty: number;
  /** Stop sequences that halt generation */
  stopSequences: string[];
  /** Enable streaming response */
  streaming: boolean;
}

export const defaultApiParameters: ApiParameters = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  stopSequences: [],
  streaming: true
};

// ============================================================================
// API Configuration
// ============================================================================

/**
 * Complete API configuration for a node
 * Combines connection, parameters, and prompts
 */
export interface ApiConfiguration {
  /** Connection settings (endpoint, apiKey, model) */
  connection: ApiConnection;
  /** Generation parameters */
  parameters: ApiParameters;
  /** System prompt as a TextBlockList (supports virtual blocks) */
  systemPrompt: TextBlockList;
  /** User prompt as a TextBlockList (supports virtual blocks) */
  userPrompt: TextBlockList;
}

/**
 * Create a new API configuration with default values
 */
export function createApiConfiguration(): ApiConfiguration {
  return {
    connection: { ...defaultApiConnection },
    parameters: { ...defaultApiParameters },
    systemPrompt: createTextBlockList(),
    userPrompt: createTextBlockList()
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all node dependencies from both system and user prompts
 */
export function getApiConfigDependencies(config: ApiConfiguration): NodeId[] {
  const systemDeps = getDependencies(config.systemPrompt);
  const userDeps = getDependencies(config.userPrompt);
  return [...new Set([...systemDeps, ...userDeps])];
}

/**
 * Update connection settings
 */
export function updateApiConnection(
  config: ApiConfiguration,
  connection: Partial<ApiConnection>
): ApiConfiguration {
  return {
    ...config,
    connection: { ...config.connection, ...connection }
  };
}

/**
 * Update request parameters
 */
export function updateApiParameters(
  config: ApiConfiguration,
  parameters: Partial<ApiParameters>
): ApiConfiguration {
  return {
    ...config,
    parameters: { ...config.parameters, ...parameters }
  };
}

/**
 * Update system prompt
 */
export function updateSystemPrompt(
  config: ApiConfiguration,
  systemPrompt: TextBlockList
): ApiConfiguration {
  return { ...config, systemPrompt };
}

/**
 * Update user prompt
 */
export function updateUserPrompt(
  config: ApiConfiguration,
  userPrompt: TextBlockList
): ApiConfiguration {
  return { ...config, userPrompt };
}
