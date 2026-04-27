import { NextResponse } from 'next/server'
import { listManuscriptsFiles } from '@flowcabal/engine'

export async function GET() {
  const projectDir = process.cwd()
  const files = await listManuscriptsFiles(projectDir)
  return NextResponse.json({ files })
}
