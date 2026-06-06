/**
 * Resize an image File to fit within a max dimension, returning a JPEG Blob.
 *
 * Run client-side BEFORE uploading so phone photos (typically 3–8 MB on
 * modern phones) don't bump into Vercel's 4.5 MB serverless function body
 * limit. Also massively speeds up the upload itself.
 *
 * Falls back to the original file if the browser can't decode it (e.g.
 * HEIC on non-Apple browsers).
 */
export async function resizeImage(
  file: File,
  maxDim = 2000,
  quality = 0.85,
): Promise<File> {
  // If it's already small enough, skip resize entirely
  if (file.size < 800 * 1024) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Browser couldn't decode (e.g. HEIC on Android/desktop Chrome).
    // Send original — the server's Sharp pipeline will handle it.
    return file
  }

  const { width, height } = bitmap
  if (width <= maxDim && height <= maxDim) {
    bitmap.close?.()
    return file
  }

  const scale = Math.min(maxDim / width, maxDim / height)
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close?.()

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) return file

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
}
