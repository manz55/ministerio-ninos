import { AlertTriangle } from 'lucide-react'

interface Props {
  allergies?: string | null
  medicalNotes?: string | null
}

export function MedicalAlert({ allergies, medicalNotes }: Props) {
  if (!allergies && !medicalNotes) return null
  return (
    <div className="rounded-xl bg-red-50 border-2 border-red-300 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-500" size={22} />
        <div>
          <p className="font-bold text-red-800 uppercase tracking-wide text-sm">
            ¡Atención médica!
          </p>
          {allergies && (
            <p className="mt-1 text-sm text-red-700">
              <span className="font-semibold">Alergias:</span> {allergies}
            </p>
          )}
          {medicalNotes && (
            <p className="mt-1 text-sm text-red-700">
              <span className="font-semibold">Notas médicas:</span> {medicalNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
