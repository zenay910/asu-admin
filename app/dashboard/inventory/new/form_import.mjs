import { createClient } from '@/lib/supabase/server';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'appliances';

const ALLOWED = {
  configuration: new Set([
    'Front Load',
    'Top Load',
    'Stacked Unit',
    'Standard',
    'Slide-In',
    'Glass Cooktop',
    'Coil Cooktop',
  ]),
  unit_type: new Set(['Individual', 'Set']),
  fuel: new Set(['Electric', 'Gas', '']),
  condition: new Set(['New', 'Good', 'Fair', 'Poor']),
  status: new Set(['Draft', 'Published', 'Archived']),
};

const norm = (v) => (v ?? '').toString().trim() || null;
const cleanMoney = (v) =>
  v === null || v === undefined || v === ''
    ? null
    : Number(String(v).replace(/[^0-9.]/g, ''));

function parseDimensionsField(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (/^[\[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return null;

  const parsed = {};
  if (nums.length >= 1) parsed.width_in = nums[0];
  if (nums.length >= 2) parsed.depth_in = nums[1];
  if (nums.length >= 3) parsed.height_in = nums[2];
  parsed.unit_of_measure = 'inches';
  return parsed;
}

function parseFeaturesField(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (/^[\[{]/.test(text)) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((item) => norm(item)).filter(Boolean);
        return normalized.length ? normalized : null;
      }
    } catch {
      return null;
    }
  }

  const normalized = text
    .split(/[|;,]/)
    .map((item) => norm(item))
    .filter(Boolean);
  return normalized.length ? normalized : null;
}

function validateEnum(name, value) {
  if (value == null || value === '') return null;
  if (!ALLOWED[name].has(value)) {
    throw new Error(`Invalid ${name} "${value}". Allowed: ${[...ALLOWED[name]].join(', ')}`);
  }
  return value;
}

function isFormData(input) {
  // Some server environments (or Next.js server actions) pass a FormData-like
  // object that may not be `instanceof FormData`. Detect by presence of
  // the `get`/`getAll` methods as a more robust check.
  if (!input) return false;
  if (typeof input.getAll === 'function' && typeof input.get === 'function') return true;
  return typeof FormData !== 'undefined' && input instanceof FormData;
}

function getField(formInput, key) {
  if (isFormData(formInput)) {
    const raw = formInput.get(key);
    if (raw == null) return null;
    if (typeof raw === 'string') return raw;
    return null;
  }
  return formInput?.[key] ?? null;
}

function getPreUploadedImageUrls(formInput) {
  if (!isFormData(formInput)) {
    return formInput?.imageUrls ? (Array.isArray(formInput.imageUrls) ? formInput.imageUrls : [formInput.imageUrls]) : [];
  }
  // Try to read multiple possible shapes from FormData-like inputs.
  try {
    if (typeof formInput.getAll === 'function') {
      const all = formInput.getAll('imageUrls');
      if (Array.isArray(all) && all.length) {
        return all
          .map((v) => (typeof v === 'string' ? v : String(v)))
          .filter((url) => typeof url === 'string' && url.trim());
      }
    }

    if (typeof formInput.get === 'function') {
      const single = formInput.get('imageUrls');
      if (single != null) {
        return [typeof single === 'string' ? single : String(single)].filter((u) => u.trim());
      }
    }

    // As a last resort, iterate entries to locate any 'imageUrls' keys.
    if (typeof formInput.entries === 'function') {
      const found = [];
      for (const [k, v] of formInput.entries()) {
        if (k === 'imageUrls') {
          found.push(typeof v === 'string' ? v : String(v));
        }
      }
      return found.filter((u) => u && u.trim());
    }
  } catch {
    // ignore and fall through to empty
  }

  return [];
}

async function collectImages(formInput, explicitImages = []) {
  const images = [];

  for (const image of explicitImages || []) {
    images.push(image);
  }

  if (isFormData(formInput)) {
    const fromForm = formInput.getAll('images');
    for (const file of fromForm) {
      if (!file || typeof file !== 'object' || typeof file.name !== 'string' || typeof file.size !== 'number' || file.size <= 0) {
        continue;
      }
      images.push({
        name: file.name,
        contentType: file.type || undefined,
        data: file,
      });
    }
  }

  return images.filter((img) => img?.name && img?.data);
}

async function uploadImageToStorage(supabase, file, productId, index) {
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || 'jpg';
  const storageName = `${String(index + 1).padStart(3, '0')}.${ext}`;
  const objectPath = `${productId}/original/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file.data, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.contentType || file.data?.type || 'application/octet-stream',
    });

  if (uploadError) {
    throw new Error(`Image upload failed (${file.name}): ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

function buildProductPayload(formInput) {
  const title = norm(getField(formInput, 'title'));
  const brand = norm(getField(formInput, 'brand'));
  const model_number = norm(getField(formInput, 'model_number'));
  const type = norm(getField(formInput, 'type'));
  const configuration = norm(getField(formInput, 'configuration'));
  const unit_type = validateEnum('unit_type', norm(getField(formInput, 'unit_type')));
  const fuel = validateEnum('fuel', norm(getField(formInput, 'fuel')));
  const condition = validateEnum('condition', norm(getField(formInput, 'condition')));
  const status = validateEnum('status', norm(getField(formInput, 'status')) || 'Draft');
  const price = cleanMoney(getField(formInput, 'price'));
  const color = norm(getField(formInput, 'color'));
  const capacityRaw = norm(getField(formInput, 'capacity'));
  const capacity = capacityRaw ? Number(String(capacityRaw).replace(/[^0-9.]/g, '')) : null;
  const description_long = norm(getField(formInput, 'description_long'));
  const dimensions = parseDimensionsField(getField(formInput, 'dimensions'));
  const features = parseFeaturesField(getField(formInput, 'features'));
  const ageRaw = norm(getField(formInput, 'age'));
  const age = ageRaw ? Number(String(ageRaw).replace(/[^0-9]/g, '')) : null;

  if (!title) {
    throw new Error('Missing required field: title');
  }
  if (price === null || Number.isNaN(price)) {
    throw new Error('Missing or invalid required field: price');
  }
  if (configuration) {
    validateEnum('configuration', configuration);
  }

  return {
    title,
    brand,
    price,
    model_number,
    type,
    configuration,
    dimensions,
    capacity: Number.isFinite(capacity) ? capacity : null,
    fuel,
    unit_type: unit_type || 'Individual',
    color,
    age: Number.isFinite(age) ? age : null,
    features,
    condition: condition || 'Good',
    status,
    description_long,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Import one product from form-style input.
 *
 * @param {Object|FormData} formInput - Plain object or FormData containing product fields.
 * @param {string} [productIdOverride] - If provided, update existing product instead of creating new
 * @param {Array<string>} [preUploadedUrls] - Pre-uploaded image URLs to associate with product
 * @returns {Promise<{productId: string, uploadedImages: number}>}
 */
export async function importProductFromForm(formInput, productIdOverride, preUploadedUrls = []) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be logged in to add inventory items.');
  }

  const payload = buildProductPayload(formInput);
  const preUploadedImageUrls = preUploadedUrls || getPreUploadedImageUrls(formInput);
  const imagesToUpload = await collectImages(formInput);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[importProductFromForm] imagesToUpload:', imagesToUpload.length);
    console.log(
      '[importProductFromForm] image names:',
      imagesToUpload.map((image) => image.name),
    );
  }

  let productId = productIdOverride;
  
  if (productIdOverride) {
    // Update existing product
    const { error: updateError } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productIdOverride);

    if (updateError) {
      throw new Error(`Product update failed: ${updateError.message}`);
    }
  } else {
    // Create new product
    const { data: inserted, error: insertError } = await supabase
      .from('products')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Product insert failed: ${insertError.message}`);
    }

    if (!inserted?.id) {
      throw new Error('Product insert succeeded but no ID was returned.');
    }

    productId = inserted.id;
  }

  let uploadedImages = 0;

  for (let index = 0; index < imagesToUpload.length; index += 1) {
    const url = await uploadImageToStorage(supabase, imagesToUpload[index], productId, index);

    const { error: imageRowError } = await supabase
      .from('product_images')
      .insert({ product_id: productId, photo_url: url });

    if (imageRowError) {
      throw new Error(`Image row insert failed: ${imageRowError.message}`);
    }

    uploadedImages += 1;
  }

  // Insert pre-uploaded image URLs
  for (const url of preUploadedImageUrls) {
    const { error: imageRowError } = await supabase
      .from('product_images')
      .insert({ product_id: productId, photo_url: url });

      console.log('Images: ', photo_url)

    if (imageRowError) {
      throw new Error(`Image row insert failed: ${imageRowError.message}`);
    }

    uploadedImages += 1;
  }

  return { productId, uploadedImages };
}

/**
 * Import many products from form-style rows.
 *
 * @param {Array<Object|FormData>} rows
 * @param {Object} options
 * @returns {Promise<{total: number, success: number, failed: number, errors: Array<{index:number,error:string}>}>}
 */
export async function importProductsFromRows(rows, options = {}) {
  const result = {
    total: rows.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < rows.length; index++) {
    try {
      await importProductFromForm(rows[index], options);
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ index, error: error?.message || String(error) });
    }
  }

  return result;
}

export {
  buildProductPayload,
  collectImages,
  getPreUploadedImageUrls,
  uploadImageToStorage,
};
