import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary, pageIsFinnish, reloadPage } from './ui/ErrorBoundary'
// Dev-only: the ternary lets the production build drop these chunks entirely.
const StressToggle = import.meta.env.DEV ? lazy(() => import('./dev/StressToggle').then((module) => ({ default: module.StressToggle }))) : () => null
const DesignSystemPreview = import.meta.env.DEV ? lazy(() => import('./design-system/DesignSystemPreview').then((module) => ({ default: module.DesignSystemPreview }))) : () => null
import './design-system/tokens.css'
import './ui/ui.css'

function AppCrashed() {
  const fi = pageIsFinnish()
  return <main className="app-shell loading-shell"><div className="state-panel" role="alert"><img src="/logo-64.png" alt="" width="40" height="40" /><h1>{fi ? 'Jokin meni vikaan' : 'Something went wrong'}</h1><p>{fi ? 'Sivu kohtasi virheen. Uudelleenlataus yleensä korjaa sen.' : 'The page hit an error. Reloading usually fixes it.'}</p><button type="button" className="state-panel-action" onClick={reloadPage}>{fi ? 'Lataa sivu uudelleen' : 'Reload page'}</button></div></main>
}

const designSystemMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('design-system') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode><ErrorBoundary fallback={<AppCrashed />}>{designSystemMode ? <Suspense fallback={<p>Loading preview…</p>}><DesignSystemPreview /></Suspense> : <App />}{import.meta.env.DEV && new URLSearchParams(window.location.search).has('stress') && <Suspense fallback={null}><StressToggle /></Suspense>}</ErrorBoundary></StrictMode>,
)
