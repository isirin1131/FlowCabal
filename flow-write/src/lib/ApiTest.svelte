<script lang="ts">
  import { OpenAICompatibleClient, buildChatRequest } from './api/client';
  import type {
    ChatMessage,
    ChatCompletionRequest,
    UsageInfo
  } from './api/types';

  // ============================================================================
  // State Types
  // ============================================================================

  interface TestMessage extends ChatMessage {
    id: string;
    timestamp: number;
  }

  type ResponseStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

  interface ResponseState {
    status: ResponseStatus;
    content: string;
    error: string | null;
    usage: UsageInfo | null;
    responseTime: number | null;
  }

  // ============================================================================
  // State
  // ============================================================================

  let endpoint = $state('https://api.openai.com/v1');
  let apiKey = $state('');
  let model = $state('gpt-4o');

  let temperature = $state(0.7);
  let maxTokens = $state(4096);
  let topP = $state(1);
  let streaming = $state(true);
  let stopSequences = $state<string[]>([]);

  let systemPrompt = $state('');
  let messages = $state<TestMessage[]>([]);
  let userInput = $state('');
  let showSettings = $state(true);

  let response = $state<ResponseState>({
    status: 'idle',
    content: '',
    error: null,
    usage: null,
    responseTime: null
  });

  let abortController: AbortController | null = null;

  // ============================================================================
  // Helpers
  // ============================================================================

  function createTestMessage(
    role: ChatMessage['role'],
    content: string
  ): TestMessage {
    return {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now()
    };
  }

  function getClient(): OpenAICompatibleClient {
    return new OpenAICompatibleClient({
      endpoint,
      apiKey
    });
  }

  function buildRequest(): ChatCompletionRequest {
    const req_messages: ChatMessage[] = [];

    if (systemPrompt.trim()) {
      req_messages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      req_messages.push({ role: msg.role, content: msg.content });
    }

    if (userInput.trim()) {
      req_messages.push({ role: 'user', content: userInput });
    }

    const request: ChatCompletionRequest = {
      model,
      messages: req_messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream: streaming
    };

    if (stopSequences.length > 0) {
      request.stop = stopSequences;
    }

    return request;
  }

  async function sendRequest() {
    if (!apiKey) {
      response = {
        status: 'error',
        content: '',
        error: 'API key is required',
        usage: null,
        responseTime: null
      };
      return;
    }

    if (!endpoint) {
      response = {
        status: 'error',
        content: '',
        error: 'Endpoint URL is required',
        usage: null,
        responseTime: null
      };
      return;
    }

    const client = getClient();
    const request = buildRequest();
    const startTime = Date.now();

    if (userInput.trim()) {
      messages = [...messages, createTestMessage('user', userInput)];
      userInput = '';
    }

    response = {
      status: streaming ? 'streaming' : 'loading',
      content: '',
      error: null,
      usage: null,
      responseTime: null
    };

    abortController = new AbortController();

    try {
      if (streaming) {
        let content = '';

        for await (const chunk of client.chatCompletionStream(request)) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            content += delta.content;
          }

          response = {
            status: 'streaming',
            content,
            error: null,
            usage: chunk.usage ?? null,
            responseTime: Date.now() - startTime
          };
        }

        response = { ...response, status: 'success' };

        if (content) {
          messages = [...messages, createTestMessage('assistant', content)];
        }
      } else {
        const chatResponse = await client.chatCompletion(request);
        const choice = chatResponse.choices[0];

        response = {
          status: 'success',
          content: choice?.message.content ?? '',
          error: null,
          usage: chatResponse.usage,
          responseTime: Date.now() - startTime
        };

        if (choice?.message.content) {
          messages = [...messages, createTestMessage('assistant', choice.message.content)];
        }
      }
    } catch (err) {
      response = {
        status: 'error',
        content: '',
        error: err instanceof Error ? err.message : 'Unknown error',
        usage: null,
        responseTime: Date.now() - startTime
      };
    }

    abortController = null;
  }

  function cancelRequest() {
    abortController?.abort();
    response = { ...response, status: 'idle' };
  }

  function clearHistory() {
    messages = [];
    response = {
      status: 'idle',
      content: '',
      error: null,
      usage: null,
      responseTime: null
    };
  }

  function deleteMessage(id: string) {
    messages = messages.filter(m => m.id !== id);
  }

  function addStopSequence() {
    const seq = prompt('Enter stop sequence:');
    if (seq) {
      stopSequences = [...stopSequences, seq];
    }
  }

  function removeStopSequence(index: number) {
    stopSequences = stopSequences.filter((_, i) => i !== index);
  }
</script>

<div class="api-test">
  <div class="header">
    <h2>LLM API Test</h2>
    <div class="header-actions">
      <button class="btn-icon" onclick={() => showSettings = !showSettings}>
        {showSettings ? '◀' : '▶'} Settings
      </button>
    </div>
  </div>

  <div class="main-layout" class:collapsed={!showSettings}>
    {#if showSettings}
      <div class="settings-panel">
        <section class="settings-section">
          <h3>Connection</h3>
          <div class="form-group">
            <label for="endpoint">Endpoint URL</label>
            <input
              id="endpoint"
              type="text"
              bind:value={endpoint}
              placeholder="https://api.openai.com/v1"
            />
            <span class="hint">OpenAI-compatible API endpoint</span>
          </div>
          <div class="form-group">
            <label for="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              bind:value={apiKey}
              placeholder="sk-..."
            />
          </div>
          <div class="form-group">
            <label for="model">Model</label>
            <input
              id="model"
              type="text"
              bind:value={model}
              placeholder="gpt-4o"
            />
          </div>
        </section>

        <section class="settings-section">
          <h3>Parameters</h3>
          <label class="toggle">
            <input type="checkbox" bind:checked={streaming} />
            <span>Streaming</span>
          </label>
          <div class="form-group">
            <label for="temperature">
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              bind:value={temperature}
            />
          </div>
          <div class="form-group">
            <label for="max-tokens">Max Tokens: {maxTokens}</label>
            <input
              id="max-tokens"
              type="range"
              min="256"
              max="8192"
              step="256"
              bind:value={maxTokens}
            />
          </div>
          <div class="form-group">
            <label for="top-p">Top P: {topP.toFixed(2)}</label>
            <input
              id="top-p"
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={topP}
            />
          </div>
          <div class="form-group">
            <label for="stop-sequences">Stop Sequences</label>
            <div class="stop-sequences">
              {#each stopSequences as seq, i}
                <span class="tag">
                  {seq}
                  <button onclick={() => removeStopSequence(i)}>×</button>
                </span>
              {/each}
              <button class="btn-small" onclick={addStopSequence}>+ Add</button>
            </div>
          </div>
        </section>
      </div>
    {/if}

    <div class="chat-panel">
      <div class="system-prompt">
        <label for="system-prompt">System Prompt</label>
        <textarea
          id="system-prompt"
          bind:value={systemPrompt}
          placeholder="You are a helpful assistant..."
          rows="3"
        ></textarea>
      </div>

      <div class="messages">
        {#each messages as msg (msg.id)}
          <div class="message {msg.role}">
            <div class="message-header">
              <span class="role">{msg.role}</span>
              <button class="btn-delete" onclick={() => deleteMessage(msg.id)}>×</button>
            </div>
            <div class="content">{msg.content}</div>
          </div>
        {/each}

        {#if response.status === 'streaming' || response.status === 'loading'}
          <div class="message assistant streaming">
            <div class="message-header">
              <span class="role">assistant</span>
              <span class="status">{response.status}...</span>
            </div>
            <div class="content">
              {response.content || '...'}
              <span class="cursor">▌</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="input-area">
        <textarea
          bind:value={userInput}
          placeholder="Type your message..."
          rows="3"
          onkeydown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              sendRequest();
            }
          }}
        ></textarea>
        <div class="input-actions">
          <button class="btn-secondary" onclick={clearHistory}>Clear</button>
          {#if response.status === 'streaming' || response.status === 'loading'}
            <button class="btn-danger" onclick={cancelRequest}>Cancel</button>
          {:else}
            <button
              class="btn-primary"
              onclick={sendRequest}
              disabled={!apiKey || !endpoint}
            >
              Send (Ctrl+Enter)
            </button>
          {/if}
        </div>
      </div>

      {#if response.status === 'success' || response.status === 'error'}
        <div class="response-info">
          {#if response.error}
            <div class="error">{response.error}</div>
          {/if}
          {#if response.usage}
            <div class="usage">
              Tokens: {response.usage.prompt_tokens} prompt +
              {response.usage.completion_tokens} completion =
              {response.usage.total_tokens} total
              {#if response.usage.prompt_cache_hit_tokens}
                (cache hit: {response.usage.prompt_cache_hit_tokens})
              {/if}
            </div>
          {/if}
          {#if response.responseTime}
            <div class="time">Response time: {(response.responseTime / 1000).toFixed(2)}s</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .api-test {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0f0f1a;
    color: #e0e0e0;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #2d2d44;
  }

  .header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .main-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    flex: 1;
    overflow: hidden;
  }

  .main-layout.collapsed {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    padding: 16px;
    border-right: 1px solid #2d2d44;
    overflow-y: auto;
    background: #12121f;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section h3 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
    color: #8b8b9e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    color: #a0a0b0;
  }

  .form-group input[type="text"],
  .form-group input[type="password"] {
    width: 100%;
    padding: 8px 12px;
    background: #1a1a2e;
    border: 1px solid #2d2d44;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
  }

  .form-group input[type="range"] {
    width: 100%;
    accent-color: #6366f1;
  }

  .hint {
    font-size: 11px;
    color: #666;
    margin-top: 4px;
    display: block;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    cursor: pointer;
    font-size: 13px;
  }

  .toggle input {
    accent-color: #6366f1;
  }

  .stop-sequences {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: #2d2d44;
    border-radius: 4px;
    font-size: 12px;
  }

  .tag button {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 0;
    font-size: 14px;
  }

  .chat-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .system-prompt {
    padding: 16px;
    border-bottom: 1px solid #2d2d44;
  }

  .system-prompt label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: #8b8b9e;
  }

  .system-prompt textarea,
  .input-area textarea {
    width: 100%;
    padding: 12px;
    background: #1a1a2e;
    border: 1px solid #2d2d44;
    border-radius: 8px;
    color: #e0e0e0;
    font-size: 14px;
    resize: vertical;
    font-family: inherit;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .message {
    margin-bottom: 16px;
    padding: 12px 16px;
    border-radius: 8px;
  }

  .message.user {
    background: #1a2a3a;
    margin-left: 32px;
  }

  .message.assistant {
    background: #1a1a2e;
    margin-right: 32px;
  }

  .message.system {
    background: #2a1a2a;
    font-style: italic;
  }

  .message.streaming {
    border: 1px solid #6366f1;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .role {
    font-size: 12px;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
  }

  .status {
    font-size: 12px;
    color: #8b8b9e;
  }

  .btn-delete {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
  }

  .btn-delete:hover {
    color: #ef4444;
  }

  .content {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .cursor {
    animation: blink 1s infinite;
    color: #6366f1;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  .input-area {
    padding: 16px;
    border-top: 1px solid #2d2d44;
  }

  .input-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .response-info {
    padding: 12px 16px;
    background: #12121f;
    border-top: 1px solid #2d2d44;
    font-size: 12px;
  }

  .response-info .error {
    color: #ef4444;
    margin-bottom: 4px;
  }

  .response-info .usage {
    color: #8b8b9e;
  }

  .response-info .time {
    color: #8b8b9e;
    margin-top: 4px;
  }

  button {
    font-family: inherit;
  }

  .btn-primary {
    padding: 8px 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 8px 16px;
    background: #2d2d44;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-secondary:hover {
    background: #3d3d5c;
  }

  .btn-danger {
    padding: 8px 16px;
    background: #dc2626;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-icon {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid #2d2d44;
    border-radius: 6px;
    color: #a0a0b0;
    font-size: 13px;
    cursor: pointer;
  }

  .btn-icon:hover {
    background: #2d2d44;
  }

  .btn-small {
    padding: 2px 8px;
    background: #2d2d44;
    border: none;
    border-radius: 4px;
    color: #a0a0b0;
    font-size: 12px;
    cursor: pointer;
  }
</style>
