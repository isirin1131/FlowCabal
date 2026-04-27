'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { EditorDef, EditorConfigData } from '@/lib/editors'
import type { LlmConfig } from '@flowcabal/engine'
import { Pencil, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'

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

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState('editor')

  // ── Editor state ──
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

  // ── LLM state ──
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

  // ── LLM actions ──

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

  // ── Helpers ──

  const passwordValue = llmMode === 'edit' && !showPasswordEdited
    ? (llmForm.apiKey ? '••••••••' : '')
    : llmForm.apiKey

  const formValid = llmForm.name.trim() && llmForm.apiKey.trim() && llmForm.model.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="editor" className="flex-1">编辑器</TabsTrigger>
            <TabsTrigger value="llm" className="flex-1">LLM 配置</TabsTrigger>
          </TabsList>

          {/* ── Editor Tab ── */}
          <TabsContent value="editor">
            <div className="py-4 min-h-[120px]">
              {editorLoading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">默认编辑器</label>
                  <p className="text-xs text-muted-foreground">
                    在本地打开文件时使用的编辑器
                  </p>
                  <Select
                    value={editorConfig?.default || 'vscode'}
                    onValueChange={(value) =>
                      setEditorConfig(prev => prev ? { ...prev, default: value } : null)
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="选择编辑器" />
                    </SelectTrigger>
                    <SelectContent>
                      {allEditors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id}>
                          {editor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── LLM Config Tab ── */}
          <TabsContent value="llm">
            <div className="py-2 min-h-[120px]">
              {llmMode === 'list' ? (
                <div className="flex flex-col gap-2">
                  {llmLoading ? (
                    <div className="text-sm text-muted-foreground py-4">加载中...</div>
                  ) : !llmConfigs || Object.keys(llmConfigs).length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">暂无 LLM 配置</div>
                  ) : (
                    <div className="divide-y border rounded-lg overflow-hidden">
                      {Object.entries(llmConfigs).map(([name, cfg]) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-card/50"
                        >
                          <span className="font-medium min-w-0 truncate">{name}</span>
                          {name === 'default' && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] h-4 px-1.5">
                              默认
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs shrink-0">
                            {PROVIDER_LABELS[cfg.provider] || cfg.provider}
                          </span>
                          <span className="text-muted-foreground/70 text-xs min-w-0 truncate flex-1">
                            {cfg.model}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(name)}
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => deleteLlmConfig(name)}
                            disabled={llmDeleting === name}
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start mt-2"
                    onClick={startAdd}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加配置
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-medium">
                    {llmMode === 'add' ? '添加 LLM 配置' : `编辑 "${llmEditingName}"`}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium">名称</label>
                      <Input
                        value={llmForm.name}
                        onChange={e => setLlmForm(p => ({ ...p, name: e.target.value }))}
                        disabled={llmMode === 'edit'}
                        placeholder="如 default"
                        className="h-8 text-sm"
                      />
                      {llmMode === 'add' && (
                        <p className="text-[10px] text-muted-foreground">
                          命名为 &quot;default&quot; 即为默认配置
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium">提供商</label>
                      <Select
                        value={llmForm.provider}
                        onValueChange={v => setLlmForm(p => ({ ...p, provider: v }))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {llmForm.provider === 'openai-compatible' && (
                      <div className="flex flex-col gap-1.5 col-span-2">
                        <label className="text-xs font-medium">Base URL</label>
                        <Input
                          value={llmForm.baseURL}
                          onChange={e => setLlmForm(p => ({ ...p, baseURL: e.target.value }))}
                          placeholder="如 https://api.deepseek.com/v1"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-medium">API Key</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordValue}
                          onChange={e => {
                            setLlmForm(p => ({ ...p, apiKey: e.target.value }))
                            if (llmMode === 'edit') setShowPasswordEdited(true)
                          }}
                          placeholder="sk-..."
                          className="h-8 text-sm pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium">模型</label>
                      <Input
                        value={llmForm.model}
                        onChange={e => setLlmForm(p => ({ ...p, model: e.target.value }))}
                        placeholder="如 gpt-4o"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">温度</label>
                      <Input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={llmForm.temperature}
                        onChange={e => setLlmForm(p => ({ ...p, temperature: e.target.value }))}
                        placeholder="0.7"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">Max Tokens</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={llmForm.maxTokens}
                        onChange={e => setLlmForm(p => ({ ...p, maxTokens: e.target.value }))}
                        placeholder="4096"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Advanced options */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors -ml-1"
                  >
                    {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    高级选项
                  </button>

                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Top P</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={llmForm.topP}
                          onChange={e => setLlmForm(p => ({ ...p, topP: e.target.value }))}
                          placeholder="1.0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Frequency Penalty</label>
                        <Input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.frequencyPenalty}
                          onChange={e => setLlmForm(p => ({ ...p, frequencyPenalty: e.target.value }))}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Presence Penalty</label>
                        <Input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.presencePenalty}
                          onChange={e => setLlmForm(p => ({ ...p, presencePenalty: e.target.value }))}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end mt-1">
                    <Button variant="outline" size="sm" onClick={cancelForm}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveLlmConfig}
                      disabled={!formValid || llmSaving}
                    >
                      {llmSaving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
          {tab === 'editor' && (
            <Button
              size="sm"
              onClick={saveEditorConfig}
              disabled={editorLoading || editorSaving}
            >
              {editorSaving ? '保存中...' : '保存'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
