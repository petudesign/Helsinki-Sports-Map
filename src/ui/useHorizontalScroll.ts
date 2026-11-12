import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A horizontally scrolling row that also works with a mouse: the vertical wheel
 * scrolls it sideways, and `canStart` / `canEnd` drive the edge fades and the
 * page buttons. Touch and trackpads keep their native horizontal scrolling.
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [edges, setEdges] = useState({ canStart: false, canEnd: false })
  const frame = useRef(0)

  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (!node) return
      const canStart = node.scrollLeft > 8 // scroll-snap rests the first chip at the 4 px focus padding
      const canEnd = node.scrollLeft + node.clientWidth < node.scrollWidth - 8
      setEdges((current) => current.canStart === canStart && current.canEnd === canEnd ? current : { canStart, canEnd })
    })
  }, [node])

  useEffect(() => {
    if (!node) return
    measure()
    const onWheel = (event: WheelEvent) => {
      // Only translate a mostly-vertical wheel; let horizontal trackpad gestures through untouched.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || node.scrollWidth <= node.clientWidth) return
      event.preventDefault()
      node.scrollLeft += event.deltaY
    }
    const resize = new ResizeObserver(measure)
    resize.observe(node)
    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('scroll', measure, { passive: true })
    return () => { resize.disconnect(); node.removeEventListener('wheel', onWheel); node.removeEventListener('scroll', measure); cancelAnimationFrame(frame.current) }
  }, [node, measure])

  const page = useCallback((direction: 1 | -1) => {
    if (!node) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollBy({ left: direction * node.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' })
  }, [node])

  return { ref: setNode, ...edges, page, measure }
}
