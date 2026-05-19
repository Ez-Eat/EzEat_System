import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const project = await prisma.clientProject.findUnique({
    where: { accessCode: code },
    select: {
      clientName: true,
      projectName: true,
      startDate: true,
      estimatedEnd: true,
      modules: true,
      updates: true,
      active: true,
    },
  })

  if (!project || !project.active) {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.json(project)
}
