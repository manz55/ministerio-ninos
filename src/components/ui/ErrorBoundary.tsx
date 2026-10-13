import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only in dev — a production console should stay empty for anyone
    // poking at DevTools, not print internal errors or stack traces.
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 gap-6 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center">
            <AlertTriangle size={36} className="text-red-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-display font-semibold text-gray-900">Algo salió mal</h1>
            <p className="text-sm text-gray-500 max-w-xs">Intenta recargar la página. Si sigue pasando, avísale al administrador.</p>
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
          >
            Recargar app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
