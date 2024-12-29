import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
export const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://galleria-df.vercel.app'  // Production URL exactly matching your frontend
      : process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3001',  // Development
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'  // Added to support credentials if needed
} as const;

// Shared OPTIONS handler
export async function handleOptions(_request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}