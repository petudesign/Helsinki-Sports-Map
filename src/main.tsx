import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
const DesignSystemPreview = lazy(() => import('./design-system/DesignSystemPreview').then((module) => ({ default: module.DesignSystemPreview })))
import './design-system/tokens.css'
import './styles.css'
import './map.css'

const designSystemMode = new URLSearchParams(window.location.search).get('design-system') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{designSystemMode ? <Suspense fallback={<p>Loading preview…</p>}><DesignSystemPreview /></Suspense> : <App />}</StrictMode>,
)
