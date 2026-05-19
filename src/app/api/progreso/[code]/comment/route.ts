import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import type { ProjectComment } from '@/actions/client-projects'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  let body: { moduleIndex: number; authorName: string; message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { moduleIndex, authorName, message } = body
  if (typeof moduleIndex !== 'number' || !authorName?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const project = await prisma.clientProject.findUnique({
    where: { accessCode: code },
    select: { id: true, active: true, comments: true },
  })

  if (!project || !project.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const existing = (project.comments as unknown as ProjectComment[]) ?? []
  const newComment: ProjectComment = {
    id:          crypto.randomUUID(),
    moduleIndex,
    authorName:  authorName.trim().substring(0, 100),
    message:     message.trim().substring(0, 2000),
    date:        new Date().toISOString(),
  }

  await prisma.clientProject.update({
    where: { id: project.id },
    data:  { comments: [...existing, newComment] as unknown as never },
  })

  return NextResponse.json(newComment, { status: 201 })
}
