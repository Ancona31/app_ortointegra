import { Image, StyleSheet, View } from '@react-pdf/renderer'

interface Props {
  logoUrl?: string
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermark: {
    width: 220,
    height: 220,
    opacity: 0.05,
    transform: 'rotate(-25deg)',
  },
})

export default function PdfWatermark({ logoUrl }: Props) {
  if (!logoUrl) return null

  return (
    <View fixed style={s.container}>
      {logoUrl ? <Image style={s.watermark} src={logoUrl} /> : null}
    </View>
  )
}
