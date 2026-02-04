/**
 * Settings Keys
 *
 * Well-known settings keys used throughout the app
 */

export const SETTINGS_KEYS = {
  // API Test page settings
  API_TEST_ENDPOINT: 'apiTest:endpoint',
  API_TEST_API_KEY: 'apiTest:apiKey',
  API_TEST_MODEL: 'apiTest:model',
  API_TEST_TEMPERATURE: 'apiTest:temperature',
  API_TEST_MAX_TOKENS: 'apiTest:maxTokens',
  API_TEST_TOP_P: 'apiTest:topP',
  API_TEST_STREAMING: 'apiTest:streaming',
  API_TEST_STOP_SEQUENCES: 'apiTest:stopSequences',
  API_TEST_SYSTEM_PROMPT: 'apiTest:systemPrompt',
  API_TEST_MESSAGES: 'apiTest:messages',

  // App preferences
  PREFERENCES_ACTIVE_PAGE: 'preferences:activePage',
  PREFERENCES_SHOW_SETTINGS: 'preferences:showSettings'
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
