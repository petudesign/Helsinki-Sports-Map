import { Component, type ReactNode } from 'react'

// Catches render errors and failed lazy chunks (for example an old tab after a
// deploy). A failed import() stays rejected, so the fallbacks offer a reload
// rather than a re-render.
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export const reloadPage = () => window.location.reload()

// The app sets <html lang> from the chosen locale, so fallbacks outside the
// app's state can still match its language.
export const pageIsFinnish = () => document.documentElement.lang === 'fi'
