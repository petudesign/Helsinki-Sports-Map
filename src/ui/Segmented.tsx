import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; ariaLabel?: string; lang?: string }

/**
 * One segmented control for every either/or choice (2D/Tilt, EN/FI, price…).
 * Radio-group semantics: one Tab stop, arrow keys move and select, Home/End jump.
 * The raised thumb slides on the compositor via transform (no parent CSS vars).
 */
export function Segmented<T extends string>({ label, value, options, onChange, className = '', orientation = 'horizontal' }: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
  orientation?: 'horizontal' | 'vertical'
}) {
  const groupRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const hasPositionedRef = useRef(false)
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value))

  useLayoutEffect(() => {
    const group = groupRef.current
    const thumb = thumbRef.current
    const update = (animate: boolean) => {
      const target = refs.current[activeIndex]
      if (!thumb || !target) return
      if (!animate) thumb.style.transition = 'none'
      thumb.style.width = `${target.offsetWidth}px`
      thumb.style.height = `${target.offsetHeight}px`
      thumb.style.transform = `translate3d(${target.offsetLeft}px, ${target.offsetTop}px, 0)`
      thumb.style.opacity = '1'
      if (!animate) {
        void thumb.offsetWidth
        thumb.style.transition = ''
      }
    }
    update(hasPositionedRef.current)
    hasPositionedRef.current = true
    if (!group) return
    const observer = new ResizeObserver(() => update(false))
    observer.observe(group)
    return () => observer.disconnect()
  }, [activeIndex, options.length, orientation])

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
  return <div ref={groupRef} className={`segmented ${className}`} role="radiogroup" aria-label={label} aria-orientation={orientation} data-orientation={orientation}>
    <span ref={thumbRef} className="segmented-thumb" aria-hidden="true" />
    {options.map((option, index) => {
      const checked = option.value === value
      return <button key={option.value} ref={(node) => { refs.current[index] = node }} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1}
        aria-label={option.ariaLabel} lang={option.lang} className="segmented-item" onClick={() => onChange(option.value)} onKeyDown={(event) => move(event, index)}>
        {option.label}
      </button>
    })}
  </div>
}
