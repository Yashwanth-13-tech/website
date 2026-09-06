import React from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Admin Error Boundary Caught]:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/50 p-8 sm:p-12 text-center shadow-sm max-w-2xl mx-auto my-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4 ring-8 ring-red-50">
            <AlertTriangle size={28} />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-charcoal-900">
            {this.props.title || 'Something went wrong in this section'}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-charcoal-600 max-w-md">
            An unexpected error occurred while rendering this page. You can try refreshing this view or navigating to another section.
          </p>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-4 max-h-32 w-full overflow-auto rounded-xl bg-charcoal-900 p-3 text-left font-mono text-[11px] text-red-300">
              {this.state.error.toString()}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-charcoal-800 transition-all"
            >
              <RotateCcw size={14} />
              <span>Retry / Reload Section</span>
            </button>

            {this.props.fallbackAction && this.props.fallbackAction}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AdminErrorBoundary
