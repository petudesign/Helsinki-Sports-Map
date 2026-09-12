import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DesignSystemPreview } from './design-system/DesignSystemPreview'
import './design-system/tokens.css'
import './styles.css'

const designSystemMode = new URLSearchParams(window.location.search).get('design-system') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{designSystemMode ? <DesignSystemPreview /> : <App />}</StrictMode>,
)
