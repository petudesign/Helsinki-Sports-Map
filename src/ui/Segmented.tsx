import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; ariaLabel?: string; lang?: string }

/**
 * One segmented control for every either/or choice (2D/Tilt, EN/FI, price…).
 * Radio-group semantics: one Tab stop, arrow keys move and select, Home/End jump.
 */
export function Segmented<T extends string>({ label, value, options, onChange, className = '', orientation = 'horizontal' }: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
  orientation?: 'horizontal' | 'vertical'
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : undefined
    if (next === undefined) return
    event.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return <div className={`segmented ${className}`} role="radiogroup" aria-label={label} aria-orientation={orientation} data-orientation={orientation}>
    {options.map((option, index) => {
      const checked = option.value === value
      return <button key={option.value} ref={(node) => { refs.current[index] = node }} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1}
        aria-label={option.ariaLabel} lang={option.lang} className="segmented-item" onClick={() => onChange(option.value)} onKeyDown={(event) => move(event, index)}>
        {option.label}
      </button>
    })}
  </div>
}
