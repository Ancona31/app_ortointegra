import { Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer'
import type { PdfColors } from './PdfStyles'

export function BarraTop({ colors }: { colors: PdfColors }) {
  return (
    <Svg width="100%" height={12}>
      <Defs>
        <LinearGradient id="gradTop" x1="0" y1="0" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.cp} />
          <Stop offset="100%" stopColor={colors.cs} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={12} fill="url(#gradTop)" />
    </Svg>
  )
}

export function BarraBottom({ colors }: { colors: PdfColors }) {
  return (
    <Svg width="100%" height={8} style={{ marginTop: 16 }}>
      <Defs>
        <LinearGradient id="gradBot" x1="0" y1="0" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.cp} />
          <Stop offset="100%" stopColor={colors.cs} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height={8} fill="url(#gradBot)" />
    </Svg>
  )
}
