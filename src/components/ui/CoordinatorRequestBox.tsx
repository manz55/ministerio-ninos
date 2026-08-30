import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Send, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Regular maestros can't register a family or change a category themselves
// (see the isAdmin gates in CheckInPage) — this is what replaces the old
// dead-end "avísale a tu coordinador" text with something that actually
// reaches one, via the coordinator_requests table the admin inbox reads.
// The child/parent fields below are optional structure on top of the free
// text — coordinator_requests has no columns for them, so they're folded
// into the message as a labeled block a coordinator can read at a glance
// instead of having to parse prose for a name and a date.
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
  const [childName, setChildName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const hasContent = !!(message.trim() || childName.trim())

  async function send() {
    if (!hasContent || sending) return
    setSending(true)
    const childBlock = [
      childName.trim() && `Nombre del niño: ${childName.trim()}`,
      birthDate && `Fecha de nacimiento: ${format(new Date(`${birthDate}T00:00:00`), 'd MMM yyyy', { locale: es })}`,
      parentName.trim() && `Padre/madre: ${parentName.trim()}`,
      phone.trim() && `Teléfono: ${phone.trim()}`,
    ].filter(Boolean).join('\n')
    const fullMessage = [message.trim(), childBlock].filter(Boolean).join('\n\n')
    const { error } = await supabase
      .from('coordinator_requests')
      .insert({ message: fullMessage, author_id: authorId })
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
    <div className="space-y-2.5 text-left max-w-sm mx-auto">
      <p className="text-xs text-gray-400 text-center">¿Es familia nueva o hay que cambiar algo? Envíale una nota a tu coordinador.</p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Cuéntale a tu coordinador qué necesitas…"
        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none resize-none placeholder:text-gray-300"
      />

      <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Datos del niño (opcional)</p>
        <input
          type="text"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="Nombre del niño"
          className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
        />
        <input
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none text-gray-700"
        />
        <input
          type="text"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="Nombre del papá o mamá"
          className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
        />
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono del papá o mamá"
          className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
        />
      </div>

      <button
        onClick={send}
        disabled={!hasContent || sending}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        <Send size={14} />
        {sending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </div>
  )
}
