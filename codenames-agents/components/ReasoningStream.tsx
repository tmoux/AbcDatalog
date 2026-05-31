'use client'

import { useEffect, useRef } from 'react'

interface Props {
  text: string
  isStreaming: boolean
  label?: string
}

export default function ReasoningStream({ text, isStreaming, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [text])

  if (!text && !isStreaming) return null

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
          {label}
          {isStreaming && (
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
      )}
      <div
        ref={ref}
        className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 font-mono leading-relaxed
                   overflow-y-auto max-h-48 border border-gray-700 whitespace-pre-wrap"
      >
        {text || <span className="text-gray-600 italic">Waiting for agent response...</span>}
        {isStreaming && <span className="inline-block w-1.5 h-3 bg-green-400 ml-0.5 animate-pulse" />}
      </div>
    </div>
  )
}
