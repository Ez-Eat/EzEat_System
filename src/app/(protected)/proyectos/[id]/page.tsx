import { getClientProject, updateClientProject, deleteClientProject } from '@/actions/client-projects'
import { ProjectForm } from '@/components/proyectos/project-form'
import { notFound, redirect } from 'next/navigation'
import type {
  ProjectModule, ProjectUpdate, GanttTask,
  ProjectContact, ProjectCommunication,
  ProjectComment, ProjectApproval,
} from '@/actions/client-projects'
import { CheckCircle2, XCircle, MessageSquare, ThumbsUp, ThumbsDown, Info } from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Client Feedback Section ─────────────────────────────────────────────────

function ClientFeedback({
  modules,
  comments,
  approvals,
}: {
  modules: ProjectModule[]
  comments: ProjectComment[]
  approvals: ProjectApproval[]
}) {
  const hasAny = comments.length > 0 || approvals.length > 0

  return (
    <div className="max-w-5xl mx-auto mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-800">Feedback del cliente</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
          <Info size={11} className="text-amber-600" />
          <span className="text-[11px] font-medium text-amber-700">
            Solo informativo — las aprobaciones no bloquean el desarrollo
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MessageSquare size={11} /> {comments.length} comentario{comments.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp size={11} /> {approvals.filter(a => a.status === 'approved').length} aprobado{approvals.filter(a => a.status === 'approved').length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown size={11} /> {approvals.filter(a => a.status === 'rejected').length} rechazado{approvals.filter(a => a.status === 'rejected').length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {!hasAny ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          <MessageSquare size={24} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">El cliente aún no ha dejado comentarios ni aprobaciones.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => {
            const modComments = comments
              .filter(c => c.moduleIndex === idx)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            const approval = approvals.find(a => a.moduleIndex === idx)

            if (!modComments.length && !approval) return null

            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Module header */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{mod.name}</span>
                  </div>
                  {approval ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      approval.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {approval.status === 'approved'
                        ? <CheckCircle2 size={11} />
                        : <XCircle size={11} />
                      }
                      {approval.status === 'approved' ? 'Aprobado' : 'Rechazado'} por {approval.authorName}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Sin decisión del cliente</span>
                  )}
                </div>

                {/* Approval note */}
                {approval?.note && (
                  <div className={`px-5 py-2.5 text-xs border-b ${
                    approval.status === 'approved'
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                      : 'bg-red-50/50 border-red-100 text-red-800'
                  }`}>
                    <span className="font-semibold">Nota:</span> {approval.note}
                    <span className="ml-2 text-[10px] opacity-60">{fmtDate(approval.date)}</span>
                  </div>
                )}

                {/* Comments */}
                {modComments.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {modComments.map(c => (
                      <div key={c.id} className="px-5 py-3 flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-700 uppercase">
                          {c.authorName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700">{c.authorName}</span>
                            <span className="text-[10px] text-slate-400">{fmtDate(c.date)}</span>
                          </div>
                          <p className="text-sm text-slate-600">{c.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function EditProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getClientProject(id)
  if (!project) notFound()

  const modules    = project.modules    as unknown as ProjectModule[]
  const comments   = (project.comments  ?? []) as unknown as ProjectComment[]
  const approvals  = (project.approvals ?? []) as unknown as ProjectApproval[]

  async function handleUpdate(data: Parameters<typeof updateClientProject>[1]) {
    'use server'
    await updateClientProject(id, data)
    redirect('/proyectos')
  }

  async function handleDelete() {
    'use server'
    await deleteClientProject(id)
    redirect('/proyectos')
  }

  return (
    <>
      <ProjectForm
        mode="edit"
        initialData={{
          id:           project.id,
          accessCode:   project.accessCode,
          clientName:   project.clientName,
          projectName:  project.projectName,
          startDate:    project.startDate,
          estimatedEnd: project.estimatedEnd,
          modules,
          updates:        project.updates        as unknown as ProjectUpdate[],
          gantt:          (project.gantt ?? [])  as unknown as GanttTask[],
          active:         project.active,
          contacts:       (project.contacts       ?? []) as unknown as ProjectContact[],
          communications: (project.communications ?? []) as unknown as ProjectCommunication[],
        }}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
      />

      <ClientFeedback
        modules={modules}
        comments={comments}
        approvals={approvals}
      />
    </>
  )
}
