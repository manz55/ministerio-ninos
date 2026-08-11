import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 gap-6 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-gray-900">Algo salió mal</h1>
            <p className="text-sm text-gray-500 max-w-xs">{this.state.error.message}</p>
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
