import { NextRequest, NextResponse } from 'next/server';
import { importProductFromForm } from '@/app/dashboard/inventory/new/form_import.mjs';

// Configure API route to accept larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const { productId, uploadedImages } = await importProductFromForm(formData);

    return NextResponse.json({
      success: true,
      message: `Inventory item created (ID: ${productId}) with ${uploadedImages} image(s).`,
      productId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Inventory creation error:', message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
