import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import type { ProjectApproval } from '@/actions/client-projects'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  let body: { moduleIndex: number; status: 'approved' | 'rejected'; note?: string; authorName: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { moduleIndex, status, note, authorName } = body
  if (typeof moduleIndex !== 'number' || !['approved', 'rejected'].includes(status) || !authorName?.trim()) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const project = await prisma.clientProject.findUnique({
    where: { accessCode: code },
    select: { id: true, active: true, approvals: true },
  })

  if (!project || !project.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const existing = (project.approvals as unknown as ProjectApproval[]) ?? []
  // Remove previous approval for this module (one approval per module)
  const filtered = existing.filter(a => a.moduleIndex !== moduleIndex)

  const newApproval: ProjectApproval = {
    moduleIndex,
    status,
    note:       note?.trim().substring(0, 500),
    date:       new Date().toISOString(),
    authorName: authorName.trim().substring(0, 100),
  }

  await prisma.clientProject.update({
    where: { id: project.id },
    data:  { approvals: [...filtered, newApproval] as unknown as never },
  })

  return NextResponse.json(newApproval, { status: 201 })
}
