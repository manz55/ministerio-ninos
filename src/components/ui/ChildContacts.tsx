import { useState, useEffect, useCallback } from 'react'
import { Phone, Plus, Trash2, UserPlus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadPhoto } from '../../lib/photo'
import { useAuth } from '../../lib/auth'
import { PhotoCapture, PhotoAvatar } from './PhotoCapture'
import { GUARDIAN_RELATIONSHIP_LABELS, type ChildContact, type GuardianRelationship } from '../../types/domain'

function NewContactForm({ childId, onSaved, onCancel }: { childId: string; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>('')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase.from('child_contacts').insert({
      child_id: childId,
      full_name: name.trim(),
      phone: phone.trim() || null,
      relationship: relationship || null,
    }).select().single()
    if (err || !data) { setSaving(false); setError('Error al guardar.'); return }
    if (photoBlob) {
      const path = await uploadPhoto(`contacts/${data.id}.jpg`, photoBlob)
      if (path) await supabase.from('child_contacts').update({ photo_url: path }).eq('id', data.id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="border-2 border-dashed border-indigo-200 rounded-xl p-3 space-y-2.5 bg-indigo-50">
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <PhotoCapture onFileReady={setPhotoBlob} size={56} />
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo *" autoFocus
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)"
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      <select value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship | '')}
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white">
        <option value="">Parentesco (opcional)</option>
        {Object.entries(GUARDIAN_RELATIONSHIP_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-[2] py-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Check size={14} />
          {saving ? 'Guardando…' : 'Agregar contacto'}
        </button>
      </div>
    </div>
  )
}

/**
 * Extra pickup/drop-off contacts for a child, beyond the primary responsable —
 * e.g. an aunt or family friend who left their number that day. Any logged-in
 * maestro or admin can add one on the spot; only admins can remove one.
 */
export function ChildContacts({ childId }: { childId: string }) {
  const { isAdmin } = useAuth()
  const [contacts, setContacts] = useState<ChildContact[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from('child_contacts').select('*').eq('child_id', childId).order('created_at')
    setContacts((data as ChildContact[]) ?? [])
    setLoading(false)
  }, [childId])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  async function handleDelete(id: string) {
    await supabase.from('child_contacts').delete().eq('id', id)
    fetchContacts()
  }

  if (loading) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
        <UserPlus size={12} /> Otros contactos autorizados
      </p>

      {contacts.map((c) => (
        <div key={c.id} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
          <PhotoAvatar path={c.photo_url} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{c.full_name}</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {c.relationship && <span>{GUARDIAN_RELATIONSHIP_LABELS[c.relationship]}</span>}
              {c.relationship && c.phone && <span>·</span>}
              {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <NewContactForm childId={childId} onSaved={() => { setAdding(false); fetchContacts() }} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
          <Plus size={13} /> Agregar contacto
        </button>
      )}
    </div>
  )
}
