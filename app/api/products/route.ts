import { NextRequest, NextResponse } from 'next/server';
import { productSchema } from "@/app/schemas/productSchema";
import supabase from '@/app/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    
    const body = await request.json();
    
    const validation = productSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues },
            { status: 400 }
        );
    }

    const validatedData = validation.data;
    
    const { data, error } = await supabase
      .from('products')
      .insert([validatedData])
      .select();
    
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    
    return NextResponse.json(
      { message: 'Product created successfully', product: data },
      { status: 201 }
    );
    
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
