import { useState } from 'react'
import { Send, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Regular maestros can't register a family or change a category themselves
// (see the isAdmin gates in CheckInPage) — this is what replaces the old
// dead-end "avísale a tu coordinador" text with something that actually
// reaches one, via the coordinator_requests table Coder's admin view reads.
export function CoordinatorRequestBox({
  authorId,
  defaultMessage,
  onSent,
}: {
  authorId: string
  defaultMessage?: string
  onSent?: () => void
}) {
  const [message, setMessage] = useState(defaultMessage ?? '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function send() {
    if (!message.trim() || sending) return
    setSending(true)
    const { error } = await supabase
      .from('coordinator_requests')
      .insert({ message: message.trim(), author_id: authorId })
    setSending(false)
    if (!error) { setSent(true); onSent?.() }
  }

  if (sent) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium py-3">
        <Check size={16} />
        Enviada — tu coordinador la verá al abrir la app.
      </div>
    )
  }

  return (
    <div className="space-y-2 text-left max-w-sm mx-auto">
      <p className="text-xs text-gray-400 text-center">¿Es familia nueva o hay que cambiar algo? Envíale una nota a tu coordinador.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Por favor agregar a este niño…"
        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none placeholder:text-gray-300"
      />
      <button
        onClick={send}
        disabled={!message.trim() || sending}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        <Send size={14} />
        {sending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </div>
  )
}
