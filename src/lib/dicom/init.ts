let initialized = false

export async function initCornerstone(): Promise<void> {
  if (initialized) return

  // Imports dinámicos para evitar análisis de Turbopack en build time
  const { init: csRenderInit, volumeLoader, cornerstoneStreamingImageVolumeLoader } = await import('@cornerstonejs/core')
  const { init: csToolsInit }  = await import('@cornerstonejs/tools')
  const { init: loaderInit }   = await import('@cornerstonejs/dicom-image-loader')

  await csRenderInit()
  await csToolsInit()
  loaderInit()

  // Registrar loader de volúmenes para MPR
  try {
    volumeLoader.registerVolumeLoader(
      'cornerstoneStreamingImageVolume',
      cornerstoneStreamingImageVolumeLoader as any,
    )
  } catch { /* ya registrado */ }

  initialized = true
}
