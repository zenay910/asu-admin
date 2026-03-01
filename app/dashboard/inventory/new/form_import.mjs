import { createClient } from '@/lib/supabase/server';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

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

function extensionFromName(filename) {
  const parts = String(filename || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function guessType(filename, explicitType) {
  if (explicitType) return explicitType;
  const ext = extensionFromName(filename);
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function sortFilesSmart(files) {
  return [...files].sort((a, b) => {
    const aCover = /^1[^0-9]?/.test(a.name) || /cover/i.test(a.name);
    const bCover = /^1[^0-9]?/.test(b.name) || /cover/i.test(b.name);
    if (aCover && !bCover) return -1;
    if (!aCover && bCover) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function isFormData(input) {
  return typeof FormData !== 'undefined' && input instanceof FormData;
}

function isFileLike(value) {
  return value instanceof File;
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

async function collectImages(formInput, explicitImages = []) {
  const images = [];

  for (const image of explicitImages || []) {
    images.push(image);
  }

  if (isFormData(formInput)) {
    const fromForm = formInput.getAll('images').filter(isFileLike).filter((file) => file.size > 0);
    for (const file of fromForm) {
      images.push({
        name: file.name,
        contentType: file.type || undefined,
        data: file,
      });
    }
  }

  return images.filter((img) => img?.name && img?.data);
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
 * @param {Object} options
 * @param {Array<{name: string, data: File, contentType?: string}>} [options.images]
 * @param {string} [options.bucket]
 * @param {boolean} [options.skipImages]
 * @returns {Promise<{productId: string, uploadedImages: number}>}
 */
export async function importProductFromForm(formInput, options = {}) {
  const supabase = await createClient();
  const bucket = options.bucket || process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'appliances';

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be logged in to add inventory items.');
  }

  const payload = buildProductPayload(formInput);

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

  const productId = inserted.id;

  if (options.skipImages) {
    return { productId, uploadedImages: 0 };
  }

  const images = await collectImages(formInput, options.images || []);
  const sortedImages = sortFilesSmart(images);

  let uploadedImages = 0;

  for (let i = 0; i < sortedImages.length; i++) {
    const image = sortedImages[i];
    const ext = extensionFromName(image.name) || 'jpg';
    const storageName = `${String(i + 1).padStart(3, '0')}.${ext}`;
    const objectPath = `${productId}/original/${storageName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, image.data, {
        cacheControl: '3600',
        upsert: true,
        contentType: guessType(image.name, image.contentType),
      });

    if (uploadError) {
      throw new Error(`Image upload failed (${image.name}): ${uploadError.message}`);
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;

    const { error: imageRowError } = await supabase
      .from('product_images')
      .insert({ product_id: productId, photo_url: publicUrl });

    if (imageRowError) {
      throw new Error(`Image row insert failed (${image.name}): ${imageRowError.message}`);
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
