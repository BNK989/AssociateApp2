"use client"

import React, { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  className?: string
  immediateLabel?: string
}

export function IosTimePicker({
  value,
  onChange,
  min = 0,
  max = 99,
  className,
  immediateLabel = "Immediate",
  height = 200, // Default height
  itemHeight = 40,
}: TimePickerProps & { height?: number; itemHeight?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Generate range of numbers
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  // Sync scroll position with value prop
  useEffect(() => {
    if (scrollRef.current && !isScrolling) {
      const index = range.indexOf(value)
      if (index !== -1) {
        scrollRef.current.scrollTop = index * itemHeight
      }
    }
  }, [value, isScrolling, range, itemHeight])

  const handleScroll = () => {
    if (!scrollRef.current) return

    setIsScrolling(true)

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Set new timer to detect scroll end
    timerRef.current = setTimeout(() => {
      setIsScrolling(false)
      if (scrollRef.current) {
        const scrollTop = scrollRef.current.scrollTop
        const index = Math.round(scrollTop / itemHeight)
        const newValue = range[index]

        // Snap visual adjustment if needed is automatic by CSS mostly, but logic sync:
        if (newValue !== undefined && newValue !== value) {
          onChange(newValue)
        }
      }
    }, 100) // Debounce scroll end
  }

  const paddingY = (height - itemHeight) / 2

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-gray-50 dark:bg-gray-900/50 rounded-lg select-none", className)}
      style={{ height }}
    >
      {/* Overlay Gradient for 3D effect */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-white/90 via-transparent to-white/90 dark:from-gray-950/90 dark:via-transparent dark:to-gray-950/90" />

      {/* Center Highlight */}
      <div
        className="absolute left-0 right-0 -translate-y-1/2 z-0 border-y border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-800/30 backdrop-blur-sm pointer-events-none"
        style={{ top: '50%', height: itemHeight }}
      />

      {/* Scroll Container */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollBehavior: 'smooth', paddingTop: paddingY, paddingBottom: paddingY }}
      >
        {range.map((num) => (
          <div
            key={num}
            className={cn(
              "flex items-center justify-center snap-center transition-all duration-200 cursor-pointer",
              value === num
                ? "text-gray-900 dark:text-white font-bold scale-110"
                : "text-gray-400 dark:text-gray-600 scale-90"
            )}
            style={{ height: itemHeight }}
            onClick={() => {
              onChange(num)
            }}
          >
            <span className="text-lg">
              {num === 0 ? immediateLabel : num}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
