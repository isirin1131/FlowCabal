'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EditorDef, EditorConfigData } from '@/lib/editors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditorSettingsDialog({ open, onOpenChange }: Props) {
  const [builtins, setBuiltins] = useState<EditorDef[]>([])
  const [config, setConfig] = useState<EditorConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/editor/config')
      if (res.ok) {
        const data = await res.json()
        setBuiltins(data.builtins)
        setConfig(data.config)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchConfig()
    }
  }, [open])

  const allEditors = config
    ? [...builtins, ...config.custom]
    : builtins

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      await fetch('/api/editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      onOpenChange(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>编辑器设置</DialogTitle>
          <DialogDescription>
            选择在本地打开文件时使用的默认编辑器
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">默认编辑器</label>
              <Select
                value={config?.default || 'vscode'}
                onValueChange={(value) =>
                  setConfig(prev => prev ? { ...prev, default: value } : null)
                }
              >
                <SelectTrigger className="h-9">
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

        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
