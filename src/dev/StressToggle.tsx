import { currentStress, stressScenarios } from './stress'

/* Dev-only worst-case switcher. Rendered only when ?stress= is present in a dev
   build, kept deliberately plain so it never reads as product UI. */
export function StressToggle() {
  const active = currentStress()
  const choose = (scenario: string) => {
    const url = new URL(window.location.href)
    if (scenario === 'off') url.searchParams.delete('stress'); else url.searchParams.set('stress', scenario)
    window.location.assign(url)
  }
  return <div style={{ position: 'fixed', left: '50%', bottom: 8, transform: 'translateX(-50%)', zIndex: 99, display: 'flex', gap: 2, padding: 2, maxWidth: 'calc(100vw - 16px)', overflowX: 'auto', borderRadius: 8, background: '#e5e5e5', font: '11px system-ui', boxShadow: '0 1px 4px rgb(0 0 0 / 15%)' }} role="group" aria-label="Stress test data">
    {stressScenarios.map((scenario) => <button key={scenario} type="button" onClick={() => choose(scenario)} aria-pressed={active === scenario} style={{ flex: '0 0 auto', border: 0, borderRadius: 6, padding: '4px 8px', background: active === scenario ? '#fff' : 'transparent', cursor: 'pointer', font: 'inherit' }}>{scenario}</button>)}
  </div>
}
