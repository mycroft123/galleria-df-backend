import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
export const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://galleria-df.vercel.app'
      : ['http://localhost:3001', 'http://localhost:3000'].includes(process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || '') 
        ? process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3001'
        : 'http://localhost:3001',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

// Shared OPTIONS handler
export async function handleOptions(_request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}