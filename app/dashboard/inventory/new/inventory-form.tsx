"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadImages } from "@/lib/supabase/storage";
import { createInventoryItem } from "./actions";
import { initialInventoryFormState } from "./types";
import { extractApplianceData } from "@/app/extract-appliance-action";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiFormValues {
  title: string;
  brand: string;
  model_number: string;
  type: string;
  configuration: string;
  fuel: string;
  capacity: string;
  color: string;
  age: string;
  dimensions: string;
  features: string;
  description_long: string;
}

const emptyAiValues: AiFormValues = {
  title: "",
  brand: "",
  model_number: "",
  type: "",
  configuration: "",
  fuel: "",
  capacity: "",
  color: "",
  age: "",
  dimensions: "",
  features: "",
  description_long: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-700 dark:text-red-300">{message}</p>;
}

function handleFieldInvalid(e: React.FormEvent<HTMLInputElement>) {
  const fieldLabel = e.currentTarget.dataset.label || "this field";
  if (e.currentTarget.validity.valueMissing) {
    e.currentTarget.setCustomValidity(
      `Please enter ${fieldLabel.toLowerCase()}.`,
    );
    return;
  }
  if (e.currentTarget.validity.badInput) {
    e.currentTarget.setCustomValidity(
      `Please enter a valid ${fieldLabel.toLowerCase()}.`,
    );
    return;
  }
  if (e.currentTarget.name === "price") {
    if (e.currentTarget.validity.rangeUnderflow) {
      e.currentTarget.setCustomValidity("Price must be 0 or greater.");
      return;
    }
    if (e.currentTarget.validity.stepMismatch) {
      e.currentTarget.setCustomValidity(
        "Price must use up to 2 decimal places (e.g. 199.99).",
      );
      return;
    }
  }
  e.currentTarget.setCustomValidity("Please check this field and try again.");
}

function clearFieldValidity(e: React.FormEvent<HTMLInputElement>) {
  e.currentTarget.setCustomValidity("");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix, keep only the base64 string
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ─── Submit Button ────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Item"}
    </Button>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function InventoryForm() {
  const [state, formAction] = useActionState(
    createInventoryItem,
    initialInventoryFormState,
  );

  // AI-controlled field values (controlled inputs)
  const [aiValues, setAiValues] = useState<AiFormValues>(emptyAiValues);

  // Tag scan state
  const [tagFile, setTagFile] = useState<File | null>(null);
  const [tagPreview, setTagPreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Existing image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── AI field change helper
  const setField =
    (field: keyof AiFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setAiValues((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Tag scan handler
  const handleTagSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0] ?? null;
    setTagFile(file);
    setExtractError(null);
    setExtractSuccess(false);
    if (file) {
      setTagPreview(URL.createObjectURL(file));
    } else {
      setTagPreview(null);
    }
  };

  const handleExtract = async () => {
    if (!tagFile) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(false);

    try {
      const base64 = await fileToBase64(tagFile);

      // Call Gemini directly from the browser
      const response = await fetch("/api/extract-appliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: tagFile.type }),
      });

      if (!response.ok) throw new Error("Extraction failed");
      const data = await response.json();

      console.log('Gemini response: ', data);

      // Map Gemini JSON → form values
      setAiValues({
        title: data.title ?? "",
        brand: data.brand ?? "",
        model_number: data.model_number ?? "",
        type: data.type ?? "",
        configuration: data.configuration ?? "",
        fuel: data.fuel ?? "",
        capacity: data.capacity != null ? String(data.capacity) : "",
        color: data.color ?? "",
        age: data.manufacture_year != null ? String(data.manufacture_year) : "",
        dimensions: data.dimensions ? JSON.stringify(data.dimensions) : "",
        features: Array.isArray(data.features) ? data.features.join(", ") : "",
        description_long: data.description_long ?? "",
      });

      setExtractSuccess(true);
    } catch (err) {
      setExtractError(
        "Could not read tag. Please fill in the fields manually.",
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClearTag = () => {
    setTagFile(null);
    setTagPreview(null);
    setExtractError(null);
    setExtractSuccess(false);
    if (tagInputRef.current) tagInputRef.current.value = "";
  };

  // ── Existing image upload handlers (unchanged)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    setImageFiles(files);
    setUploadError(null);
  };

  const handleUploadImages = async () => {
    if (imageFiles.length === 0) {
      setUploadError("Please select at least one image");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const tempProductId = `temp-${Date.now()}`;
      const urls = await uploadImages(imageFiles, tempProductId);
      setUploadedImageUrls(urls);
      setImageFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload images",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImageUrls(uploadedImageUrls.filter((_, i) => i !== index));
  };

  // ── Form submit: inject AI values + image URLs into FormData
  const handleFormAction = async (formData: FormData) => {
    // Inject AI-controlled fields
    Object.entries(aiValues).forEach(([key, value]) => {
      if (value) formData.set(key, value);
    });
    // Inject uploaded image URLs
    uploadedImageUrls.forEach((url) => {
      formData.append("imageUrls", url);
    });
    formAction(formData);
  };

  return (
    <form action={handleFormAction} className="space-y-5">
      {/* ── Server action errors / success ── */}
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      )}
      {uploadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {uploadError}
        </div>
      )}
      {state.success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.success}
        </div>
      )}

      {/* ── AI Tag Scanner ── */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            📷 Scan Appliance Tag
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Upload a photo of the appliance model tag to auto-fill the fields
            below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            ref={tagInputRef}
            type="file"
            accept="image/*"
            onChange={handleTagSelect}
            disabled={isExtracting}
            className="max-w-xs"
          />
          <Button
            type="button"
            onClick={handleExtract}
            disabled={!tagFile || isExtracting}
            variant="secondary"
          >
            {isExtracting ? "Extracting..." : "Extract Info from Tag"}
          </Button>
          {(tagFile || extractSuccess) && (
            <Button
              type="button"
              onClick={handleClearTag}
              variant="ghost"
              size="sm"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Tag image preview */}
        {tagPreview && (
          <div className="inline-block rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <img
              src={tagPreview}
              alt="Tag preview"
              className="h-32 w-auto object-contain"
            />
          </div>
        )}

        {/* Extraction error */}
        {extractError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
            ⚠️ {extractError}
          </div>
        )}

        {/* Extraction success */}
        {extractSuccess && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✓ Fields filled from tag. Please review and correct anything below
            before saving.
          </div>
        )}
      </div>

      {/* ── Title ── */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          data-label="Title"
          placeholder="e.g. Whirlpool Washer"
          value={aiValues.title}
          onChange={setField("title")}
          aria-invalid={Boolean(state.fieldErrors.title)}
          onInvalid={handleFieldInvalid}
          onInput={clearFieldValidity}
        />
        <FieldError message={state.fieldErrors.title} />
      </div>

      {/* ── Brand / Model Number ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            name="brand"
            placeholder="e.g. Whirlpool"
            value={aiValues.brand}
            onChange={setField("brand")}
            aria-invalid={Boolean(state.fieldErrors.brand)}
          />
          <FieldError message={state.fieldErrors.brand} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model_number">Model Number</Label>
          <Input
            id="model_number"
            name="model_number"
            placeholder="e.g. WFW5605MW"
            value={aiValues.model_number}
            onChange={setField("model_number")}
            aria-invalid={Boolean(state.fieldErrors.model_number)}
          />
          <FieldError message={state.fieldErrors.model_number} />
        </div>
      </div>

      {/* ── Type / Configuration ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Input
            id="type"
            name="type"
            placeholder="e.g. Washer"
            value={aiValues.type}
            onChange={setField("type")}
            aria-invalid={Boolean(state.fieldErrors.type)}
          />
          <FieldError message={state.fieldErrors.type} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="configuration">Configuration</Label>
          <Input
            id="configuration"
            name="configuration"
            list="configuration-options"
            placeholder="Front Load"
            value={aiValues.configuration}
            onChange={setField("configuration")}
            aria-invalid={Boolean(state.fieldErrors.configuration)}
          />
          <FieldError message={state.fieldErrors.configuration} />
          <datalist id="configuration-options">
            <option value="Front Load" />
            <option value="Top Load" />
            <option value="Stacked Unit" />
            <option value="Standard" />
            <option value="Slide-In" />
            <option value="Glass Cooktop" />
            <option value="Coil Cooktop" />
          </datalist>
        </div>
      </div>

      {/* ── Unit Type / Fuel ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit_type">Unit Type</Label>
          {/* Not AI-filled — stays uncontrolled */}
          <Input
            id="unit_type"
            name="unit_type"
            list="unit-type-options"
            placeholder="Individual"
            defaultValue={state.values.unit_type}
            aria-invalid={Boolean(state.fieldErrors.unit_type)}
          />
          <FieldError message={state.fieldErrors.unit_type} />
          <datalist id="unit-type-options">
            <option value="Individual" />
            <option value="Set" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuel">Fuel</Label>
          <Input
            id="fuel"
            name="fuel"
            list="fuel-options"
            placeholder="Electric"
            value={aiValues.fuel}
            onChange={setField("fuel")}
            aria-invalid={Boolean(state.fieldErrors.fuel)}
          />
          <FieldError message={state.fieldErrors.fuel} />
          <datalist id="fuel-options">
            <option value="Electric" />
            <option value="Gas" />
          </datalist>
        </div>
      </div>

      {/* ── Condition / Status / Price ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          {/* Not AI-filled */}
          <Input
            id="condition"
            name="condition"
            list="condition-options"
            defaultValue={state.values.condition}
            aria-invalid={Boolean(state.fieldErrors.condition)}
          />
          <FieldError message={state.fieldErrors.condition} />
          <datalist id="condition-options">
            <option value="New" />
            <option value="Good" />
            <option value="Fair" />
            <option value="Poor" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          {/* Not AI-filled */}
          <Input
            id="status"
            name="status"
            list="status-options"
            defaultValue={state.values.status}
            aria-invalid={Boolean(state.fieldErrors.status)}
          />
          <FieldError message={state.fieldErrors.status} />
          <datalist id="status-options">
            <option value="Draft" />
            <option value="Published" />
            <option value="Archived" />
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          {/* Not AI-filled */}
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            data-label="Price"
            placeholder="0.00"
            defaultValue={state.values.price}
            aria-invalid={Boolean(state.fieldErrors.price)}
            onInvalid={handleFieldInvalid}
            onInput={clearFieldValidity}
          />
          <FieldError message={state.fieldErrors.price} />
        </div>
      </div>

      {/* ── Color / Capacity / Age ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            placeholder="e.g. Stainless Steel"
            value={aiValues.color}
            onChange={setField("color")}
            aria-invalid={Boolean(state.fieldErrors.color)}
          />
          <FieldError message={state.fieldErrors.color} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 4.5"
            value={aiValues.capacity}
            onChange={setField("capacity")}
            aria-invalid={Boolean(state.fieldErrors.capacity)}
          />
          <FieldError message={state.fieldErrors.capacity} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="age">Age (Year)</Label>
          <Input
            id="age"
            name="age"
            type="number"
            min="1900"
            step="1"
            placeholder="e.g. 2020"
            value={aiValues.age}
            onChange={setField("age")}
            aria-invalid={Boolean(state.fieldErrors.age)}
          />
          <FieldError message={state.fieldErrors.age} />
        </div>
      </div>

      {/* ── Dimensions ── */}
      <div className="space-y-2">
        <Label htmlFor="dimensions">Dimensions</Label>
        <Input
          id="dimensions"
          name="dimensions"
          placeholder='e.g. 30 x 28 x 66 or {"width_in":30,"depth_in":28,"height_in":66}'
          value={aiValues.dimensions}
          onChange={setField("dimensions")}
          aria-invalid={Boolean(state.fieldErrors.dimensions)}
        />
        <FieldError message={state.fieldErrors.dimensions} />
      </div>

      {/* ── Features ── */}
      <div className="space-y-2">
        <Label htmlFor="features">Features</Label>
        <Textarea
          id="features"
          name="features"
          rows={3}
          placeholder="Comma-separated (e.g. Steam Clean, Smart WiFi, Energy Star)"
          value={aiValues.features}
          onChange={setField("features")}
          aria-invalid={Boolean(state.fieldErrors.features)}
        />
        <FieldError message={state.fieldErrors.features} />
      </div>

      {/* ── Description ── */}
      <div className="space-y-2">
        <Label htmlFor="description_long">Description</Label>
        <Textarea
          id="description_long"
          name="description_long"
          rows={5}
          placeholder="Detailed product description"
          value={aiValues.description_long}
          onChange={setField("description_long")}
          aria-invalid={Boolean(state.fieldErrors.description_long)}
        />
        <FieldError message={state.fieldErrors.description_long} />
      </div>

      {/* ── Product Images (unchanged) ── */}
      <div className="space-y-2">
        <Label>Images</Label>
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            id="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            disabled={isUploading}
          />
          <Button
            type="button"
            onClick={handleUploadImages}
            disabled={isUploading || imageFiles.length === 0}
            variant="secondary"
          >
            {isUploading ? "Uploading..." : "Upload Images"}
          </Button>
        </div>
        {uploadedImageUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Uploaded images ({uploadedImageUrls.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {uploadedImageUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative inline-block rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
                >
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-20 h-20 object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    variant="destructive"
                    size="sm"
                    className="absolute right-0 top-0 h-6 rounded-none rounded-bl-md px-2 text-xs"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
