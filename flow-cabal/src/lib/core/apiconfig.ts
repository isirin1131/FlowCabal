/**
 * API Configuration System for FlowCabal (metadata only)
 *
 * ApiConfiguration defines the settings for an LLM API call.
 * Prompts are TextBlockLists, allowing virtual blocks that reference
 * other nodes' outputs. Runtime resolution belongs in core-runner.
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

export interface ApiConnection {
  endpoint: string;
  apiKey: string;
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

export interface ApiParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  stopSequences: string[];
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

export interface ApiConfiguration {
  connection: ApiConnection;
  parameters: ApiParameters;
  systemPrompt: TextBlockList;
  userPrompt: TextBlockList;
}

export function createApiConfiguration(): ApiConfiguration {
  return {
    connection: { ...defaultApiConnection },
    parameters: { ...defaultApiParameters },
    systemPrompt: createTextBlockList(),
    userPrompt: createTextBlockList()
  };
}

// ============================================================================
// Metadata Helpers
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
