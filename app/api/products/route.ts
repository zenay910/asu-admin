import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/app/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    
    const body = await request.json();
    
    
    const { data, error } = await supabase
      .from('products')
      .insert([body])
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
