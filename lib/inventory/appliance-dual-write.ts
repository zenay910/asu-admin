'use server'

import { revalidatePath } from 'next/cache'
import {
  buildProductPayload,
  collectImages,
  getPreUploadedImageUrls,
  uploadImageToStorage,
} from '@/app/dashboard/inventory/new/form_import.mjs'
import {
  createAppliance,
  getApplianceById,
  updateAppliance,
} from '@/lib/data/appliances'
import {
  applianceToProductMirrorPayload,
  inventoryPayloadToApplianceInput,
  resolveApplianceStatus,
} from '@/lib/inventory/appliance-product-mirror'
import { createClient } from '@/lib/supabase/server'
import type { Appliance } from '@/lib/types/inventory'

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'appliances'

const INVENTORY_PATHS = [
  '/dashboard',
  '/dashboard/inventory',
  '/dashboard/inventory/view',
  '/dashboard/inventory/new',
] as const

function storagePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl)
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`
    const index = url.pathname.indexOf(prefix)
    if (index === -1) return null
    return decodeURIComponent(url.pathname.slice(index + prefix.length))
  } catch {
    return null
  }
}

function revalidateInventoryPaths(applianceId?: string) {
  for (const path of INVENTORY_PATHS) {
    revalidatePath(path)
  }
  if (applianceId) {
    revalidatePath(`/dashboard/inventory/edit/${applianceId}`)
    revalidatePath(`/dashboard/inventory/${applianceId}`)
  }
}

async function requireAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('You must be logged in to manage inventory.')
  }
  return { supabase, user }
}

async function insertProductMirror(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appliance: Appliance,
): Promise<void> {
  const payload = applianceToProductMirrorPayload(appliance)
  const { error } = await supabase.from('products').insert({
    id: appliance.id,
    ...payload,
  })
  if (error) {
    throw new Error(`Product mirror insert failed: ${error.message}`)
  }
}

async function updateProductMirror(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appliance: Appliance,
): Promise<void> {
  const payload = applianceToProductMirrorPayload(appliance)
  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', appliance.id)
  if (error) {
    throw new Error(`Product mirror update failed: ${error.message}`)
  }
}

async function nextImageSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applianceId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('appliance_images')
    .select('sort_order')
    .eq('appliance_id', applianceId)
    .order('sort_order', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to read image sort order: ${error.message}`)
  }
  const max = data?.[0]?.sort_order
  return typeof max === 'number' ? max + 1 : 0
}

async function insertMirroredImageRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applianceId: string,
  photoUrl: string,
  sortOrder: number,
): Promise<void> {
  const { error: applianceImageError } = await supabase
    .from('appliance_images')
    .insert({
      appliance_id: applianceId,
      photo_url: photoUrl,
      sort_order: sortOrder,
    })
  if (applianceImageError) {
    throw new Error(
      `Appliance image row insert failed: ${applianceImageError.message}`,
    )
  }

  const { error: productImageError } = await supabase
    .from('product_images')
    .insert({
      product_id: applianceId,
      photo_url: photoUrl,
    })
  if (productImageError) {
    throw new Error(`Product image row insert failed: ${productImageError.message}`)
  }
}

async function syncImagesFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formInput: FormData,
  applianceId: string,
): Promise<number> {
  const imagesToUpload = await collectImages(formInput)
  const preUploadedUrls = getPreUploadedImageUrls(formInput)
  let uploaded = 0
  let sortOrder = await nextImageSortOrder(supabase, applianceId)

  for (let index = 0; index < imagesToUpload.length; index += 1) {
    const url = await uploadImageToStorage(
      supabase,
      imagesToUpload[index],
      applianceId,
      sortOrder,
    )
    await insertMirroredImageRows(supabase, applianceId, url, sortOrder)
    sortOrder += 1
    uploaded += 1
  }

  for (const url of preUploadedUrls) {
    if (!url?.trim()) continue
    await insertMirroredImageRows(supabase, applianceId, url.trim(), sortOrder)
    sortOrder += 1
    uploaded += 1
  }

  return uploaded
}

async function deleteStorageByPublicUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  publicUrl: string,
): Promise<void> {
  const path = storagePathFromPublicUrl(publicUrl)
  if (!path) return

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path])
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`)
  }
}

async function deleteStorageForAppliance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applianceId: string,
): Promise<void> {
  const prefix = `${applianceId}/original`
  const { data: listed, error: listError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(`${applianceId}/original`)

  if (listError) {
    throw new Error(`Storage list failed: ${listError.message}`)
  }

  if (!listed?.length) return

  const paths = listed.map((file) => `${prefix}/${file.name}`)
  const { error: removeError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(paths)

  if (removeError) {
    throw new Error(`Storage delete failed: ${removeError.message}`)
  }
}

/**
 * Create appliance (source of truth) + mirror product row and images.
 * Defaults `lifecycle_state='Intake'`, `status='Draft'`.
 */
export async function createApplianceDualWrite(
  formData: FormData,
): Promise<{ applianceId: string; uploadedImages: number }> {
  const { supabase } = await requireAuthUser()
  const productPayload = buildProductPayload(formData)
  const lifecycle_state = 'Intake' as const
  const status = resolveApplianceStatus(lifecycle_state, productPayload.status)

  let applianceId: string | null = null

  try {
    const appliance = await createAppliance(
      inventoryPayloadToApplianceInput(productPayload, {
        lifecycle_state,
        status,
      }),
    )
    applianceId = appliance.id

    await insertProductMirror(supabase, appliance)
    const uploadedImages = await syncImagesFromForm(
      supabase,
      formData,
      appliance.id,
    )

    revalidateInventoryPaths(appliance.id)
    return { applianceId: appliance.id, uploadedImages }
  } catch (error) {
    if (applianceId) {
      await supabase.from('product_images').delete().eq('product_id', applianceId)
      await supabase.from('appliance_images').delete().eq('appliance_id', applianceId)
      await supabase.from('products').delete().eq('id', applianceId)
      await supabase.from('appliances').delete().eq('id', applianceId)
    }
    throw error
  }
}

/** Update appliance + mirror product; append new images to both image tables. */
export async function updateApplianceDualWrite(
  applianceId: string,
  formData: FormData,
): Promise<{ uploadedImages: number }> {
  const { supabase } = await requireAuthUser()
  const existing = await getApplianceById(applianceId)
  if (!existing) {
    throw new Error('Appliance not found.')
  }

  const productPayload = buildProductPayload(formData)
  const status = resolveApplianceStatus(
    existing.lifecycle_state,
    productPayload.status,
  )

  const appliance = await updateAppliance(
    applianceId,
    inventoryPayloadToApplianceInput(productPayload, {
      lifecycle_state: existing.lifecycle_state,
      status,
    }),
  )

  await updateProductMirror(supabase, appliance)
  const uploadedImages = await syncImagesFromForm(supabase, formData, applianceId)

  revalidateInventoryPaths(applianceId)
  return { uploadedImages }
}

/** Remove one image from appliance + product mirror and storage. */
export async function removeApplianceImageDualWrite(
  imageId: string,
): Promise<void> {
  const { supabase } = await requireAuthUser()

  const { data: imageRow, error: fetchError } = await supabase
    .from('appliance_images')
    .select('id, appliance_id, photo_url')
    .eq('id', imageId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Failed to load appliance image: ${fetchError.message}`)
  }
  if (!imageRow) {
    throw new Error('Appliance image not found.')
  }

  const applianceId = String(imageRow.appliance_id)
  const photoUrl = String(imageRow.photo_url)

  await deleteStorageByPublicUrl(supabase, photoUrl)

  const { error: applianceImageError } = await supabase
    .from('appliance_images')
    .delete()
    .eq('id', imageId)
  if (applianceImageError) {
    throw new Error(
      `Appliance image delete failed: ${applianceImageError.message}`,
    )
  }

  const { error: productImageError } = await supabase
    .from('product_images')
    .delete()
    .eq('product_id', applianceId)
    .eq('photo_url', photoUrl)
  if (productImageError) {
    throw new Error(`Product image delete failed: ${productImageError.message}`)
  }

  revalidateInventoryPaths(applianceId)
}

/** Delete appliance, mirrored product, images, and storage objects (shared id). */
export async function deleteApplianceDualWrite(applianceId: string): Promise<void> {
  const { supabase } = await requireAuthUser()

  const existing = await getApplianceById(applianceId)
  if (!existing) {
    throw new Error('Appliance not found.')
  }

  await deleteStorageForAppliance(supabase, applianceId)

  const { error: productImagesError } = await supabase
    .from('product_images')
    .delete()
    .eq('product_id', applianceId)
  if (productImagesError) {
    throw new Error(
      `Product image cascade delete failed: ${productImagesError.message}`,
    )
  }

  const { error: applianceImagesError } = await supabase
    .from('appliance_images')
    .delete()
    .eq('appliance_id', applianceId)
  if (applianceImagesError) {
    throw new Error(
      `Appliance image cascade delete failed: ${applianceImagesError.message}`,
    )
  }

  const { error: productDeleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', applianceId)
  if (productDeleteError) {
    throw new Error(`Product mirror delete failed: ${productDeleteError.message}`)
  }

  const { error: applianceDeleteError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', applianceId)
  if (applianceDeleteError) {
    throw new Error(`Appliance delete failed: ${applianceDeleteError.message}`)
  }

  revalidateInventoryPaths(applianceId)
}

/** Dev smoke: create → parity check → update → delete. */
export async function runApplianceDualWriteSmokeTest(): Promise<{
  applianceId: string
  productStatus: string
  imageParity: boolean
}> {
  const form = new FormData()
  form.set('title', 'F1.1 dual-write smoke')
  form.set('price', '199')
  form.set('brand', 'SmokeBrand')
  form.set('model_number', 'SMK-001')
  form.set('status', 'Published')
  form.set('condition', 'Good')
  form.set('unit_type', 'Individual')

  const { applianceId } = await createApplianceDualWrite(form)
  const supabase = await createClient()

  const { data: appliance } = await supabase
    .from('appliances')
    .select('id, title, brand, price, lifecycle_state, status')
    .eq('id', applianceId)
    .single()

  const { data: product } = await supabase
    .from('products')
    .select('id, title, brand, price, status')
    .eq('id', applianceId)
    .single()

  if (!appliance || !product) {
    throw new Error('Dual-write rows missing after create')
  }
  if (appliance.title !== product.title || appliance.brand !== product.brand) {
    throw new Error('Field parity mismatch after create')
  }
  if (appliance.lifecycle_state !== 'Intake') {
    throw new Error('Expected lifecycle_state Intake on create')
  }
  if (product.status !== 'Draft') {
    throw new Error(
      `Published must not mirror when not Listed; got product.status=${product.status}`,
    )
  }

  const updateForm = new FormData()
  updateForm.set('title', 'F1.1 dual-write smoke updated')
  updateForm.set('price', '249')
  updateForm.set('brand', 'SmokeBrand')
  updateForm.set('model_number', 'SMK-001')
  updateForm.set('status', 'Draft')
  updateForm.set('condition', 'Good')
  updateForm.set('unit_type', 'Individual')

  await updateApplianceDualWrite(applianceId, updateForm)

  const { data: productAfter } = await supabase
    .from('products')
    .select('title, status')
    .eq('id', applianceId)
    .single()

  if (productAfter?.title !== 'F1.1 dual-write smoke updated') {
    throw new Error('Product mirror not updated after edit')
  }

  const { count: applianceImageCount } = await supabase
    .from('appliance_images')
    .select('id', { count: 'exact', head: true })
    .eq('appliance_id', applianceId)

  const { count: productImageCount } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', applianceId)

  await deleteApplianceDualWrite(applianceId)

  const { data: gone } = await supabase
    .from('appliances')
    .select('id')
    .eq('id', applianceId)
    .maybeSingle()

  if (gone) {
    throw new Error('Appliance row still present after delete')
  }

  return {
    applianceId,
    productStatus: product.status,
    imageParity: applianceImageCount === productImageCount,
  }
}
