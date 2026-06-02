'use client'

import imageCompression from 'browser-image-compression'

const MAX_DIMENSION = 2048
const INITIAL_QUALITY = 0.8

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image'
  return `${base}.jpg`
}

/**
 * Downscale and re-encode a smartphone photo for web upload (~2048px, ~0.8 quality, JPEG).
 * Converts HEIC and other formats browsers can decode.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.8,
    maxWidthOrHeight: MAX_DIMENSION,
    useWebWorker: true,
    initialQuality: INITIAL_QUALITY,
    fileType: 'image/jpeg',
  })

  return new File([compressed], jpegFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressImageForUpload(file)))
}
