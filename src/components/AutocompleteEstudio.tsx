'use client'

import { useState, useRef, useEffect } from 'react'
import { ESTUDIOS_LAB } from '@/lib/estudiosLab'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  index: number
}

export default function AutocompleteEstudio({ value, onChange, placeholder, index }: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const sugerencias = value.trim().length >= 2
    ? ESTUDIOS_LAB.filter(e =>
        e.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    setHighlighted(0)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || sugerencias.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onChange(sugerencias[highlighted])
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function select(val: string) {
    onChange(val)
    setOpen(false)
  }

  // Resalta la parte que coincide con el texto escrito
  function highlight(text: string) {
    if (!value.trim()) return text
    const idx = text.toLowerCase().indexOf(value.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-violet-100 text-violet-800 rounded">{text.slice(idx, idx + value.length)}</mark>
        {text.slice(idx + value.length)}
      </>
    )
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (sugerencias.length > 0) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Nombre del estudio'}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
      />

      {open && sugerencias.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {sugerencias.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlighted ? 'bg-[#1e5fa8] text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {i === highlighted ? s : highlight(s)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
