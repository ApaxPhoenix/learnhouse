'use client'

import { Calculator, GripVertical, Minus, X } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react'

const MIN = { width: 300, height: 260 }

// Start docked at the right, sized to fit small screens too.
function initialFrame() {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const width = Math.max(MIN.width, Math.min(520, vw - 32))
  const height = Math.max(MIN.height, Math.min(440, vh - 160))
  return {
    x: Math.max(16, vw - width - 24),
    y: Math.max(16, Math.min(120, vh - height - 80)),
    width,
    height,
  }
}

/** Floating, draggable Desmos graphing calculator (the one Bluebook uses). */
export function DesmosCalculator({ onClose }: { onClose: () => void }) {
  const [initial] = useState(initialFrame)
  const [position, setPosition] = useState({ x: initial.x, y: initial.y })
  const [size, setSize] = useState({ width: initial.width, height: initial.height })
  const [minimized, setMinimized] = useState(false)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{
    kind: 'move' | 'resize'
    x: number
    y: number
    w: number
    h: number
    px: number
    py: number
  } | null>(null)

  const onPointerMove = useCallback((event: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'move') {
      setPosition({
        x: Math.min(Math.max(8, d.px + event.clientX - d.x), window.innerWidth - 120),
        y: Math.min(Math.max(8, d.py + event.clientY - d.y), window.innerHeight - 48),
      })
    } else {
      setSize({
        width: Math.max(MIN.width, d.w + event.clientX - d.x),
        height: Math.max(MIN.height, d.h + event.clientY - d.y),
      })
    }
  }, [])

  const stop = useCallback(() => {
    drag.current = null
    setDragging(false)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stop)
  }, [onPointerMove])

  const start = (kind: 'move' | 'resize') => (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    drag.current = {
      kind,
      x: event.clientX,
      y: event.clientY,
      w: size.width,
      h: size.height,
      px: position.x,
      py: position.y,
    }
    setDragging(true)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div
      className="fixed flex flex-col overflow-hidden rounded-xl bg-white nice-shadow shadow-xl"
      style={{
        left: position.x,
        top: position.y,
        width: minimized ? 260 : size.width,
        height: minimized ? 44 : size.height,
        zIndex: 'var(--z-modal-content)',
      }}
    >
      <div
        onPointerDown={start('move')}
        className="flex h-11 shrink-0 cursor-move select-none items-center justify-between border-b border-gray-100 bg-gray-50 px-3"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <GripVertical size={14} className="text-gray-400" />
          <Calculator size={15} />
          Calculator
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 cursor-pointer"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 cursor-pointer"
            title="Close calculator"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="relative flex-1">
          <iframe
            src="https://www.desmos.com/testing/cb-digital-sat/graphing"
            title="Desmos graphing calculator"
            className="h-full w-full border-0"
          />
          {/* Keeps the iframe from swallowing pointer events mid-drag. */}
          {dragging && <div className="absolute inset-0" />}
          <div
            onPointerDown={start('resize')}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            style={{ background: 'linear-gradient(135deg, transparent 50%, #d1d5db 50%)' }}
            title="Resize"
          />
        </div>
      )}
    </div>
  )
}
