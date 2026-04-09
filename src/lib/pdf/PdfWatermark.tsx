import { Image, StyleSheet } from '@react-pdf/renderer'

interface Props {
  logoUrl?: string
}

export default function PdfWatermark({ logoUrl }: Props) {
  if (!logoUrl) return null

  const s = StyleSheet.create({
    watermark: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 400,
      height: 400,
      opacity: 0.07,
      transform: 'translate(-9%, -30%) rotate(-25deg)',
    },
  })

  return <Image style={s.watermark} src={logoUrl} />
}
