'use client'

import Image from 'next/image'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const PREVIEW_SIZE = 224
const GAP = 8

type HoverImagePreviewProps = {
  src: string
  alt: string
  thumbWidth?: number
  thumbHeight?: number
  previewSize?: number
  className?: string
}

export function HoverImagePreview({
  src,
  alt,
  thumbWidth = 48,
  thumbHeight = 48,
  previewSize = PREVIEW_SIZE,
  className,
}: HoverImagePreviewProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const spaceRight = window.innerWidth - rect.right - GAP
    const placeLeft = spaceRight < previewSize + GAP

    setPosition({
      top: rect.top + rect.height / 2,
      left: placeLeft ? rect.left - GAP - previewSize : rect.right + GAP,
    })
  }, [previewSize])

  const show = () => {
    updatePosition()
    setOpen(true)
  }

  const hide = () => setOpen(false)

  return (
    <>
      <div
        ref={anchorRef}
        className={cn('relative inline-block', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Image
          src={src}
          alt={alt}
          width={thumbWidth}
          height={thumbHeight}
          className="h-12 w-12 shrink-0 cursor-zoom-in rounded-sm border border-border object-cover transition-shadow hover:shadow-md"
        />
      </div>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[200] -translate-y-1/2 rounded-md border border-border bg-card p-1.5 shadow-xl ring-1 ring-border/60"
              style={{
                top: position.top,
                left: position.left,
                width: previewSize,
                height: previewSize,
              }}
              role="presentation"
              aria-hidden
            >
              <Image
                src={src}
                alt=""
                width={previewSize}
                height={previewSize}
                className="h-full w-full rounded-sm object-cover"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
