'use client'
import { FileText } from 'lucide-react'

export default function ManuscriptsPage() {
  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-2xl font-semibold mb-6">手稿</h1>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
        <FileText className="w-12 h-12" />
        <p>暂无手稿</p>
      </div>
    </div>
  )
}
