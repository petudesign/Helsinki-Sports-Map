import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'
const order: SheetSnap[] = ['peek', 'half', 'full']

/**
 * Bottom-sheet drag for phones (Emil Kowalski's gesture rules):
 * - the sheet tracks the finger 1:1 with transform only, no transition while dragging;
 * - a fast flick (> 0.4 px/ms) moves one snap in the flick's direction, whatever the distance;
 * - otherwise the nearest snap wins;
 * - dragging past the top or bottom is damped instead of stopping hard;
 * - pointer capture keeps the drag alive outside the handle, and a second finger is ignored;
 * - a 6 px dead zone keeps taps on header buttons working.
 * Snap heights come from CSS (--sheet-y-*), so the resting states never depend on JS.
 */
export function useSheetDrag(sheetRef: RefObject<HTMLElement | null>, snap: SheetSnap, setSnap: (snap: SheetSnap) => void, enabled: boolean) {
  const drag = useRef<{ id: number; startY: number; startOffset: number; lastY: number; lastT: number; velocity: number; active: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)

  useEffect(() => { if (!enabled && sheetRef.current) sheetRef.current.style.transform = '' }, [enabled, sheetRef])

  const offsets = () => {
    const sheet = sheetRef.current!
    const height = sheet.getBoundingClientRect().height
    const style = getComputedStyle(sheet)
    const read = (name: string) => parseFloat(style.getPropertyValue(name)) || 0
    return { height, peek: height - read('--sheet-peek-px'), half: height - window.innerHeight * 0.56, full: 0 }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    const current = new DOMMatrixReadOnly(getComputedStyle(sheetRef.current!).transform).m42
    drag.current = { id: event.pointerId, startY: event.clientY, startOffset: current, lastY: event.clientY, lastT: event.timeStamp, velocity: 0, active: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current
    if (!state || event.pointerId !== state.id) return
    const delta = event.clientY - state.startY
    if (!state.active) {
      if (Math.abs(delta) < 6) return
      state.active = true
      event.currentTarget.setPointerCapture(event.pointerId)
      sheetRef.current!.dataset.dragging = 'true'
    }
    const { peek } = offsets()
    let next = state.startOffset + delta
    if (next < 0) next = -Math.sqrt(-next) * 2            // damped above the top
    if (next > peek) next = peek + Math.sqrt(next - peek) * 2 // damped below the peek
    sheetRef.current!.style.transform = `translate3d(0, ${next}px, 0)`
    const dt = Math.max(1, event.timeStamp - state.lastT)
    state.velocity = (event.clientY - state.lastY) / dt
    state.lastY = event.clientY
    state.lastT = event.timeStamp
  }

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current
    if (!state || event.pointerId !== state.id) return
    drag.current = undefined
    if (!state.active) return
    suppressClick.current = true
    const sheet = sheetRef.current!
    const current = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42
    const positions = offsets()
    let target: SheetSnap
    if (Math.abs(state.velocity) > 0.4) {
      const index = order.indexOf(snap)
      target = order[Math.max(0, Math.min(order.length - 1, index + (state.velocity > 0 ? -1 : 1)))]
      // A fast downward flick from full height closes to the peek, as a "dismiss".
      if (state.velocity > 1.2) target = 'peek'
    } else {
      target = order.reduce((best, candidate) => Math.abs(positions[candidate] - current) < Math.abs(positions[best] - current) ? candidate : best, snap)
    }
    delete sheet.dataset.dragging
    sheet.style.transform = ''
    setSnap(target)
  }

  // A drag that started on a header button must not also "click" it.
  const onClickCapture = (event: React.MouseEvent) => { if (suppressClick.current) { suppressClick.current = false; event.stopPropagation(); event.preventDefault() } }

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onClickCapture }
}
