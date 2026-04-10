'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeCtx {
  dark: boolean
}

const ThemeContext = createContext<ThemeCtx>({ dark: false })

export function useTheme() {
  return useContext(ThemeContext)
}

function isNightTime(): boolean {
  const h = new Date().getHours()
  return h >= 19 || h < 7
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(isNightTime())
    setMounted(true)
  }, [])

  // Auto-update every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setDark(isNightTime())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return <div className="min-h-screen bg-[#f0f4f8]" />
  }

  return (
    <ThemeContext.Provider value={{ dark }}>
      <div
        className="min-h-screen relative overflow-hidden transition-colors duration-500"
        style={{
          background: dark
            ? '#020617'
            : 'linear-gradient(180deg, rgba(30,95,168,0.07) 0%, rgba(30,95,168,0.02) 50%, #f0f4f8 100%)',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
