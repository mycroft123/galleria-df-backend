import { NextResponse } from 'next/server';

// Rate limiter configuration
const REQUESTS_PER_MINUTE = 10;
const requestCounts = new Map();

// CORS configuration - now just an object, not a function
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_ALLOWED_ORIGIN || 'http://localhost:3001',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Rate limiting helper function
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  const requestData = requestCounts.get(ip) || { count: 0, windowStart: now };
  
  if (now - requestData.windowStart > windowMs) {
    requestData.count = 0;
    requestData.windowStart = now;
  }
  
  requestData.count += 1;
  requestCounts.set(ip, requestData);
  
  console.log(`\n[Rate Limit Debug] IP: ${ip}`);
  console.log(`Requests in current window: ${requestData.count}`);
  console.log(`Window start: ${new Date(requestData.windowStart).toISOString()}`);
  console.log(`Limit: ${REQUESTS_PER_MINUTE} requests per minute`);
  
  return requestData.count <= REQUESTS_PER_MINUTE;
}

// Perplexity API interaction helper
async function getPerplexityResponse(requestBody) {
  try {
    console.log('\n[Perplexity] Sending request to Perplexity API...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Perplexity API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('\n[Perplexity] Received response from Perplexity API');
    
    return data;
    
  } catch (error) {
    console.error('\n[Perplexity Error]', error);
    throw new Error(`Failed to get Perplexity response: ${error.message}`);
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders, // Now using the object directly
  });
}

// Main POST handler
export async function POST(request) {
  console.log('\n=== New Perplexity Request ===');
  const requestStart = Date.now();

  try {
    // Log request headers
    console.log('\n[Headers Debug]');
    const headers = Object.fromEntries(request.headers);
    console.log(JSON.stringify(headers, null, 2));

    // Get client IP for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    console.log(`\n[IP Debug] Detected IP: ${ip}`);

    // Check rate limit
    if (!checkRateLimit(ip)) {
      console.warn(`[Rate Limit] Request blocked for IP: ${ip}`);
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          debug: {
            processingTime: Date.now() - requestStart,
            timestamp: new Date().toISOString(),
            ip: ip
          }
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders // Now using the object directly
          }
        }
      );
    }

    // Parse request body
    console.log('\n[Body Debug] Parsing request body...');
    const body = await request.json();
    console.log('[Body Debug] Received body:', JSON.stringify(body, null, 2));

    // Validate request body
    if (!body.messages || !Array.isArray(body.messages)) {
      console.error('[Validation] Missing or invalid messages array');
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: "Messages array is required",
          debug: {
            processingTime: Date.now() - requestStart,
            timestamp: new Date().toISOString(),
            ip: ip
          }
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders // Now using the object directly
          }
        }
      );
    }

    // Get response from Perplexity
    const perplexityResponse = await getPerplexityResponse(body);

    const response = {
      ...perplexityResponse,
      debug: {
        processingTime: Date.now() - requestStart,
        timestamp: new Date().toISOString(),
        ip: ip
      }
    };

    console.log('\n[Response Debug] Sending response:', JSON.stringify(response, null, 2));
    return new NextResponse(
      JSON.stringify(response),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders // Now using the object directly
          }
      }
    );

  } catch (error) {
    console.error('\n[Error Debug] Full error:', error);
    console.error('[Error Debug] Stack trace:', error.stack);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Failed to process Perplexity request",
        details: error.message,
        debug: {
          processingTime: Date.now() - requestStart,
          timestamp: new Date().toISOString(),
          errorType: error.name,
          errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders // Now using the object directly
        }
      }
    );
  }
}