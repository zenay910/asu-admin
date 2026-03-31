'use client'

import { createClient } from './client'

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'appliances'

interface UploadImageOptions {
  onProgress?: (progress: number) => void
}

export async function uploadImageToStorage(
  file: File,
  productId: string,
  index: number,
  options: UploadImageOptions = {}
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
    const url = await uploadImageToStorage(files[i], productId, i, { onProgress })
    publicUrls.push(url)
  }

  return publicUrls
}
