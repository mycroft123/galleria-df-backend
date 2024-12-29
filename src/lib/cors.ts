import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
export const corsHeaders = {
    // In production, allow the Vercel-deployed frontend domain
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? 'https://galleria-df.vercel.app'
        : 'http://localhost:3001',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',  // Allow all headers
    'Access-Control-Allow-Credentials': 'true'
} as const;

// Helper to check if request is from allowed origin
function getOriginHeader(request: NextRequest) {
    const origin = request.headers.get('origin');
    if (!origin) return corsHeaders['Access-Control-Allow-Origin'];

    const allowedOrigin = process.env.NODE_ENV === 'production'
        ? 'https://galleria-df.vercel.app'
        : 'http://localhost:3001';

    return origin === allowedOrigin ? origin : allowedOrigin;
}

// Shared OPTIONS handler
export async function handleOptions(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            'Access-Control-Allow-Origin': getOriginHeader(request)
        },
    });
}

// Helper for other routes to get CORS headers
export function getCorsResponseHeaders(request: NextRequest) {
    return {
        ...corsHeaders,
        'Access-Control-Allow-Origin': getOriginHeader(request)
    };
}