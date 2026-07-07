import { NextResponse } from 'next/server';

export async function GET() {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  
  const options = {
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    // The "content" scope gives your app permission to manage products
    scope: 'https://www.googleapis.com/auth/content',
    // CRITICAL: "offline" forces Google to return a permanent Refresh Token
    access_type: 'offline', 
    prompt: 'consent', 
  };

  const queryString = new URLSearchParams(options).toString();
  
  return NextResponse.redirect(`${rootUrl}?${queryString}`);
}