'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditorDef, EditorConfigData } from '@/lib/editors'
import type { LlmConfig } from '@flowcabal/engine'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
]

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  PROVIDER_OPTIONS.map(o => [o.value, o.label])
)

interface LlmFormData {
  name: string
  provider: string
  baseURL: string
  apiKey: string
  model: string
  temperature: string
  maxTokens: string
  topP: string
  frequencyPenalty: string
  presencePenalty: string
}

const EMPTY_FORM: LlmFormData = {
  name: '',
  provider: 'openai',
  baseURL: '',
  apiKey: '',
  model: '',
  temperature: '',
  maxTokens: '',
  topP: '',
  frequencyPenalty: '',
  presencePenalty: '',
}

function formToConfig(data: LlmFormData): LlmConfig {
  const config: LlmConfig = {
    provider: data.provider as LlmConfig['provider'],
    apiKey: data.apiKey.trim(),
    model: data.model.trim(),
  }
  if (data.baseURL.trim()) config.baseURL = data.baseURL.trim()
  const t = parseFloat(data.temperature)
  if (!isNaN(t)) config.temperature = t
  const mt = parseInt(data.maxTokens, 10)
  if (!isNaN(mt)) config.maxTokens = mt
  const tp = parseFloat(data.topP)
  if (!isNaN(tp)) config.topP = tp
  const fp = parseFloat(data.frequencyPenalty)
  if (!isNaN(fp)) config.frequencyPenalty = fp
  const pp = parseFloat(data.presencePenalty)
  if (!isNaN(pp)) config.presencePenalty = pp
  return config
}

function FieldLabel({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <label
      className={[
        'block font-mono text-[10.5px] tracking-[0.14em] lowercase mb-1.5',
        muted ? 'text-ink-faint/80' : 'text-ink-faint',
      ].join(' ')}
    >
      {children}
    </label>
  )
}

const inputCls =
  'block w-full bg-paper-deep border border-rule rounded-md px-3 py-2 ' +
  'font-mono text-[13px] text-ink ' +
  'outline-none focus:border-clay transition-colors ' +
  'disabled:opacity-60 placeholder:text-ink-faint'

const textBtnClay =
  'font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const textBtnInk =
  'font-display italic text-[14px] text-ink-soft hover:text-ink transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const textBtnError =
  'font-display italic text-[14px] text-ink-faint hover:text-error transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'editor' | 'llm'>('editor')

  const [builtins, setBuiltins] = useState<EditorDef[]>([])
  const [editorConfig, setEditorConfig] = useState<EditorConfigData | null>(null)
  const [editorLoading, setEditorLoading] = useState(true)
  const [editorSaving, setEditorSaving] = useState(false)

  const fetchEditorConfig = async () => {
    setEditorLoading(true)
    try {
      const res = await fetch('/api/editor/config')
      if (res.ok) {
        const data = await res.json()
        setBuiltins(data.builtins)
        setEditorConfig(data.config)
      }
    } catch {
      // ignore
    } finally {
      setEditorLoading(false)
    }
  }

  const saveEditorConfig = async () => {
    if (!editorConfig) return
    setEditorSaving(true)
    try {
      await fetch('/api/editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editorConfig),
      })
    } catch {
      // ignore
    } finally {
      setEditorSaving(false)
    }
  }

  const [llmActive, setLlmActive] = useState<string>('')
  const [llmConfigs, setLlmConfigs] = useState<Record<string, LlmConfig> | null>(null)
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmMode, setLlmMode] = useState<'list' | 'add' | 'edit'>('list')
  const [llmEditingName, setLlmEditingName] = useState('')
  const [llmForm, setLlmForm] = useState<LlmFormData>(EMPTY_FORM)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmDeleting, setLlmDeleting] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPasswordEdited, setShowPasswordEdited] = useState(false)

  const fetchLlmConfigs = async () => {
    setLlmLoading(true)
    try {
      const res = await fetch('/api/llm-configs')
      if (res.ok) {
        const data = await res.json()
        setLlmActive(data.active ?? '')
        setLlmConfigs(data.configs)
      }
    } catch {
      // ignore
    } finally {
      setLlmLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchEditorConfig()
      fetchLlmConfigs()
      setTab('editor')
    }
  }, [open])

  const allEditors = editorConfig
    ? [...builtins, ...editorConfig.custom]
    : builtins

  const startAdd = () => {
    setLlmForm(EMPTY_FORM)
    setShowPassword(true)
    setShowPasswordEdited(false)
    setShowAdvanced(false)
    setLlmMode('add')
  }

  const startEdit = (name: string) => {
    const cfg = llmConfigs?.[name]
    if (!cfg) return
    setLlmForm({
      name,
      provider: cfg.provider,
      baseURL: cfg.baseURL || '',
      apiKey: cfg.apiKey,
      model: cfg.model,
      temperature: cfg.temperature?.toString() || '',
      maxTokens: cfg.maxTokens?.toString() || '',
      topP: cfg.topP?.toString() || '',
      frequencyPenalty: cfg.frequencyPenalty?.toString() || '',
      presencePenalty: cfg.presencePenalty?.toString() || '',
    })
    setShowPassword(false)
    setShowPasswordEdited(false)
    setShowAdvanced(!!(cfg.topP || cfg.frequencyPenalty || cfg.presencePenalty))
    setLlmEditingName(name)
    setLlmMode('edit')
  }

  const cancelForm = () => {
    setLlmMode('list')
    setShowPassword(false)
    setShowPasswordEdited(false)
  }

  const saveLlmConfig = async () => {
    const name = llmForm.name.trim()
    if (!name || !llmForm.apiKey.trim() || !llmForm.model.trim()) return
    setLlmSaving(true)
    try {
      const config = formToConfig(llmForm)
      await fetch('/api/llm-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      })
      await fetchLlmConfigs()
      setLlmMode('list')
    } catch {
      // ignore
    } finally {
      setLlmSaving(false)
    }
  }

  const deleteLlmConfig = async (name: string) => {
    setLlmDeleting(name)
    try {
      await fetch(`/api/llm-configs/${encodeURIComponent(name)}`, { method: 'DELETE' })
      await fetchLlmConfigs()
    } catch {
      // ignore
    } finally {
      setLlmDeleting(null)
    }
  }

  const setActiveLlmConfig = async (name: string) => {
    try {
      await fetch('/api/llm-configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: name }),
      })
      await fetchLlmConfigs()
    } catch {
      // ignore
    }
  }

  const passwordValue = llmMode === 'edit' && !showPasswordEdited
    ? (llmForm.apiKey ? '••••••••' : '')
    : llmForm.apiKey

  const formValid = llmForm.name.trim() && llmForm.apiKey.trim() && llmForm.model.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-paper border border-rule shadow-lift rounded-md max-w-[720px] sm:max-w-[720px]! w-[92vw] max-h-[82vh] p-0 gap-0 flex flex-col [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">设置</DialogTitle>

        {/* 顶部 chrome */}
        <div className="shrink-0 px-7 py-4 border-b border-rule-soft relative">
          <div className="text-center select-none">
            <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
              <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
              settings
              <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-6 top-1/2 -translate-y-1/2 font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* tab toggle */}
        <div className="shrink-0 px-7 py-3 border-b border-rule-soft flex items-baseline gap-3 font-body text-[13px]">
          <button
            type="button"
            onClick={() => setTab('editor')}
            className={[
              'relative pb-[2px] cursor-pointer transition-colors',
              tab === 'editor'
                ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                : 'text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            editor
          </button>
          <span className="text-rule select-none">·</span>
          <button
            type="button"
            onClick={() => setTab('llm')}
            className={[
              'relative pb-[2px] cursor-pointer transition-colors',
              tab === 'llm'
                ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                : 'text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            llm
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
          {tab === 'editor' && (
            <div>
              <div className="mb-2 font-display italic text-[16px] text-ink">默认编辑器</div>
              <p className="font-body text-[13px] text-ink-soft mb-5 leading-[1.55]">
                在本地打开文件时使用的编辑器。
              </p>
              {editorLoading ? (
                <div className="font-display italic text-[14px] text-ink-faint">— 加载中… —</div>
              ) : (
                <>
                  <FieldLabel>当前默认</FieldLabel>
                  <Select
                    value={editorConfig?.default || 'vscode'}
                    onValueChange={(value) =>
                      setEditorConfig(prev => prev ? { ...prev, default: value } : null)
                    }
                  >
                    <SelectTrigger className="!h-auto bg-paper-deep border border-rule rounded-md px-3 py-2 font-mono text-[13px] text-ink !ring-0 focus:border-clay">
                      <SelectValue placeholder="选择编辑器" />
                    </SelectTrigger>
                    <SelectContent className="bg-paper border-rule font-mono text-[13px]">
                      {allEditors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id}>
                          {editor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={saveEditorConfig}
                      disabled={editorSaving}
                      className={textBtnClay}
                    >
                      {editorSaving ? '保存中…' : '保存 →'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'llm' && (
            <div>
              {llmMode === 'list' ? (
                <>
                  <div className="mb-2 font-display italic text-[16px] text-ink">LLM 配置</div>
                  <p className="font-body text-[13px] text-ink-soft mb-5 leading-[1.55]">
                    命名为 <span className="font-mono text-[12px]">default</span> 的配置将作为默认 LLM。
                  </p>

                  {llmLoading ? (
                    <div className="font-display italic text-[14px] text-ink-faint">— 加载中… —</div>
                  ) : !llmConfigs || Object.keys(llmConfigs).length === 0 ? (
                    <div className="text-center py-6 font-display italic text-[14px] text-ink-soft">
                      — 暂无 LLM 配置 —
                    </div>
                  ) : (
                    <ul className="flex flex-col">
                      {Object.entries(llmConfigs).map(([name, cfg]) => {
                        const isActive = llmActive === name
                        return (
                          <li
                            key={name}
                            className={[
                              'py-3 border-b border-rule-soft last:border-b-0 flex items-baseline gap-3',
                              isActive ? 'pl-[6px] border-l-2 border-clay -ml-[8px]' : 'px-2',
                            ].join(' ')}
                          >
                            <span className="font-display text-[14.5px] text-ink shrink-0">
                              {name}
                            </span>
                            {isActive && (
                              <span className="font-display italic text-[12.5px] shrink-0">
                                <span className="text-clay">〔</span>
                                <span className="text-ink-soft mx-0.5">active</span>
                                <span className="text-clay">〕</span>
                              </span>
                            )}
                            <span className="font-display italic text-[12.5px] shrink-0">
                              <span className="text-clay">〔</span>
                              <span className="text-ink-soft mx-0.5">
                                {PROVIDER_LABELS[cfg.provider] || cfg.provider}
                              </span>
                              <span className="text-clay">〕</span>
                            </span>
                            <span className="font-mono text-[11px] text-ink-faint truncate flex-1 min-w-0">
                              {cfg.model}
                            </span>
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => setActiveLlmConfig(name)}
                                className={`${textBtnInk} shrink-0`}
                              >
                                设为活跃
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(name)}
                              className={`${textBtnInk} shrink-0`}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLlmConfig(name)}
                              disabled={llmDeleting === name}
                              className={`${textBtnError} shrink-0`}
                            >
                              {llmDeleting === name ? '删除中…' : '删除'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <div className="mt-5">
                    <button type="button" onClick={startAdd} className={textBtnClay}>
                      + 添加配置
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="font-display italic text-[16px] text-ink">
                    {llmMode === 'add' ? '添加 LLM 配置' : `编辑 "${llmEditingName}"`}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>名称</FieldLabel>
                      <input
                        type="text"
                        value={llmForm.name}
                        onChange={e => setLlmForm(p => ({ ...p, name: e.target.value }))}
                        disabled={llmMode === 'edit'}
                        placeholder="如 default"
                        className={inputCls}
                      />
                      {llmMode === 'add' && (
                        <p className="mt-1.5 font-mono text-[10.5px] text-ink-faint tracking-wide lowercase">
                          命名为 default 即为默认
                        </p>
                      )}
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>提供商</FieldLabel>
                      <Select
                        value={llmForm.provider}
                        onValueChange={v => setLlmForm(p => ({ ...p, provider: v }))}
                      >
                        <SelectTrigger className="!h-auto bg-paper-deep border border-rule rounded-md px-3 py-2 font-mono text-[13px] text-ink !ring-0 focus:border-clay">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-paper border-rule font-mono text-[13px]">
                          {PROVIDER_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {llmForm.provider === 'openai-compatible' && (
                      <div className="col-span-2">
                        <FieldLabel>Base URL</FieldLabel>
                        <input
                          type="text"
                          value={llmForm.baseURL}
                          onChange={e => setLlmForm(p => ({ ...p, baseURL: e.target.value }))}
                          placeholder="如 https://api.deepseek.com/v1"
                          className={inputCls}
                        />
                      </div>
                    )}

                    <div className="col-span-2">
                      <FieldLabel>API Key</FieldLabel>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordValue}
                          onChange={e => {
                            setLlmForm(p => ({ ...p, apiKey: e.target.value }))
                            if (llmMode === 'edit') setShowPasswordEdited(true)
                          }}
                          placeholder="sk-..."
                          className={`${inputCls} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-faint hover:text-clay transition-colors tracking-wide cursor-pointer"
                        >
                          {showPassword ? '隐藏' : '显示'}
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>模型</FieldLabel>
                      <input
                        type="text"
                        value={llmForm.model}
                        onChange={e => setLlmForm(p => ({ ...p, model: e.target.value }))}
                        placeholder="如 gpt-4o"
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel muted>温度</FieldLabel>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={llmForm.temperature}
                        onChange={e => setLlmForm(p => ({ ...p, temperature: e.target.value }))}
                        placeholder="0.7"
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel muted>Max Tokens</FieldLabel>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={llmForm.maxTokens}
                        onChange={e => setLlmForm(p => ({ ...p, maxTokens: e.target.value }))}
                        placeholder="4096"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="self-start font-mono text-[11px] text-ink-faint hover:text-ink transition-colors tracking-wide lowercase cursor-pointer"
                  >
                    {showAdvanced ? '▾ 高级参数' : '▸ 高级参数'}
                  </button>

                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldLabel muted>Top P</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={llmForm.topP}
                          onChange={e => setLlmForm(p => ({ ...p, topP: e.target.value }))}
                          placeholder="1.0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <FieldLabel muted>Frequency Penalty</FieldLabel>
                        <input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.frequencyPenalty}
                          onChange={e => setLlmForm(p => ({ ...p, frequencyPenalty: e.target.value }))}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <FieldLabel muted>Presence Penalty</FieldLabel>
                        <input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.presencePenalty}
                          onChange={e => setLlmForm(p => ({ ...p, presencePenalty: e.target.value }))}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-6 justify-end mt-2">
                    <button type="button" onClick={cancelForm} className={textBtnInk}>
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={saveLlmConfig}
                      disabled={!formValid || llmSaving}
                      className={textBtnClay}
                    >
                      {llmSaving ? '保存中…' : '保存 →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
