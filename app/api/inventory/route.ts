import { NextRequest, NextResponse } from 'next/server';
import { createApplianceDualWrite } from '@/lib/inventory/appliance-dual-write';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const { applianceId, uploadedImages } =
      await createApplianceDualWrite(formData);

    return NextResponse.json({
      success: true,
      message: `Inventory item created (ID: ${applianceId}) with ${uploadedImages} image(s).`,
      applianceId,
      productId: applianceId,
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
