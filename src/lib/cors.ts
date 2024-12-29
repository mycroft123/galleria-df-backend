import { NextRequest, NextResponse } from 'next/server';

// Define allowed origins
const allowedOrigins = {
    production: ['https://galleria-df.vercel.app'],  // Frontend production URL
    development: [
        'http://localhost:3001', 
        'http://localhost:3000',
        'https://galleria-df.vercel.app'  // Also allow production frontend in dev
    ]
};

// CORS configuration
export const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
} as const;

// Helper to get correct origin
function getOrigin(request: NextRequest) {
    const origin = request.headers.get('origin');
    console.log('Received origin:', origin); // Debug log
    
    const validOrigins = process.env.NODE_ENV === 'production' 
        ? allowedOrigins.production 
        : allowedOrigins.development;
    
    // If the origin is in our allowed list, return it
    if (origin && validOrigins.includes(origin)) {
        console.log('Allowing origin:', origin); // Debug log
        return origin;
    }
    
    // Default to the main frontend URL
    console.log('Using default origin:', validOrigins[0]); // Debug log
    return validOrigins[0];
}

// Shared OPTIONS handler
export async function handleOptions(request: NextRequest) {
    const origin = getOrigin(request);
    return new NextResponse(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            'Access-Control-Allow-Origin': origin
        },
    });
}

// Helper for other routes to get CORS headers
export function getCorsResponseHeaders(request: NextRequest) {
    const origin = getOrigin(request);
    return {
        ...corsHeaders,
        'Access-Control-Allow-Origin': origin
    };
}