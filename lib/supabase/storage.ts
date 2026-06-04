'use client'

import { createClient } from './client'

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'appliances'

export async function uploadImageToStorage(
  file: File,
  productId: string,
  index: number,
): Promise<string> {
  const supabase = createClient()

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const storageName = `${String(index + 1).padStart(3, '0')}.${ext}`
  const objectPath = `${productId}/original/${storageName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError) {
    throw new Error(`Image upload failed (${file.name}): ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

export async function uploadImages(
  files: File[],
  productId: string,
  onProgress?: (progress: number) => void
): Promise<string[]> {
  const publicUrls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const url = await uploadImageToStorage(files[i], productId, i)
    publicUrls.push(url)
    onProgress?.(((i + 1) / files.length) * 100)
  }

  return publicUrls
}

function toStoragePath(publicUrlOrPath: string): string | null {
  if (!publicUrlOrPath) return null

  try {
    if (publicUrlOrPath.startsWith('http://') || publicUrlOrPath.startsWith('https://')) {
      const url = new URL(publicUrlOrPath)
      const prefix = `/storage/v1/object/public/${BUCKET}/`
      const index = url.pathname.indexOf(prefix)
      if (index === -1) return null
      return decodeURIComponent(url.pathname.slice(index + prefix.length))
    }

    return publicUrlOrPath.replace(/^\/?/, '')
  } catch {
    return null
  }
}

export async function deleteImagesFromStorage(publicUrlsOrPaths: string[]): Promise<void> {
  const supabase = createClient()
  const paths = publicUrlsOrPaths
    .map((value) => toStoragePath(value))
    .filter((value): value is string => Boolean(value))

  if (paths.length === 0) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)

  if (error) {
    throw new Error(`Image storage delete failed: ${error.message}`)
  }
}
