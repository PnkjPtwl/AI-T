'use client'
import { useState } from 'react'

// ─── Draggable wrapper used by all HUD cards ───────────────────────────────
export function DraggableCard({
  children,
  defaultX,
  defaultY,
  onClose,
  className = '',
}: {
  children: React.ReactNode
  defaultX: number
  defaultY: number
  onClose?: () => void
  className?: string
}) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = { startX: 0, startY: 0, initX: 0, initY: 0 }
  let dragState: { startX: number; startY: number; initX: number; initY: number } | null = null

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragState = { startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragState) return
    setPos({ x: dragState.initX + e.clientX - dragState.startX, y: dragState.initY + e.clientY - dragState.startY })
  }
  const onUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    dragState = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      className={`fixed z-[110] cursor-grab active:cursor-grabbing select-none ${className}`}
    >
      {onClose && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClose() }}
          className="absolute top-2 right-2 text-white/40 hover:text-white/90 text-xs transition-colors z-10"
        >✕</button>
      )}
      {children}
    </div>
  )
}
