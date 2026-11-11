import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
const StressToggle = lazy(() => import('./dev/StressToggle').then((module) => ({ default: module.StressToggle })))
const DesignSystemPreview = lazy(() => import('./design-system/DesignSystemPreview').then((module) => ({ default: module.DesignSystemPreview })))
import './design-system/tokens.css'
import './styles.css'
import './map.css'

const designSystemMode = new URLSearchParams(window.location.search).get('design-system') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{designSystemMode ? <Suspense fallback={<p>Loading preview…</p>}><DesignSystemPreview /></Suspense> : <App />}{import.meta.env.DEV && new URLSearchParams(window.location.search).has('stress') && <Suspense fallback={null}><StressToggle /></Suspense>}</StrictMode>,
)
