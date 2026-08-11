import { useState, useRef, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'

// PIN baked into the build via env var. Set VITE_ACCESS_PIN in Netlify environment variables.
// Note: visible in the JS bundle — provides friction, not cryptographic security.
const CORRECT_PIN = (import.meta.env.VITE_ACCESS_PIN as string | undefined) ?? '1234'
const SESSION_KEY = 'ministerio_auth_v1'

export function isAuthenticated(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
}

export function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError]   = useState(false)
  const [shake, setShake]   = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { inputs.current[0]?.focus() }, [])

  function verify(pin: string) {
    if (pin === CORRECT_PIN) {
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
      onAuth()
    } else {
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setDigits(['', '', '', ''])
        setError(true)
        inputs.current[0]?.focus()
      }, 420)
    }
  }

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    setError(false)
    if (val && i < 3) inputs.current[i + 1]?.focus()
    if (next.every((d) => d !== '')) verify(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 gap-8">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck size={38} className="text-indigo-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Maestros de Niños</h1>
        <p className="text-sm text-gray-500">Ingresa el PIN para continuar</p>
      </div>

      <div className={shake ? 'animate-[shake_0.42s_ease-in-out]' : ''}>
        <div className="flex gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoComplete="off"
              className={`w-14 h-16 text-center text-3xl font-black border-2 rounded-2xl focus:outline-none transition-colors select-none ${
                error
                  ? 'border-red-400 bg-red-50 text-red-600'
                  : d
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-900'
              }`}
            />
          ))}
        </div>
      </div>

      <p className={`text-sm font-semibold text-red-600 transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>
        PIN incorrecto. Inténtalo de nuevo.
      </p>
    </div>
  )
}
