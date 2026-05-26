import { NextResponse } from 'next/server'
import { listManuscriptsFiles } from '@flowcabal/engine'
import { getProjectRoot } from '@/lib/project-root'

export async function GET() {
  const projectDir = getProjectRoot()
  const files = await listManuscriptsFiles(projectDir)
  return NextResponse.json({ files })
}
