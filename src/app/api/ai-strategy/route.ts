import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rate limiter configuration
const REQUESTS_PER_MINUTE = 10;
const requestCounts = new Map();

const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://galleria-df.vercel.app',
];

const getCorsHeaders = (request: Request): HeadersInit => {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};

// Rate limiting helper function
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  // Get the existing request count data
  const requestData = requestCounts.get(ip) || { count: 0, windowStart: now };
  
  // If the window has expired, reset the count
  if (now - requestData.windowStart > windowMs) {
    requestData.count = 0;
    requestData.windowStart = now;
  }
  
  // Increment request count
  requestData.count += 1;
  
  // Update the map
  requestCounts.set(ip, requestData);
  
  // Log rate limit info for debugging
  console.log(`\n[Rate Limit Debug] IP: ${ip}`);
  console.log(`Requests in current window: ${requestData.count}`);
  console.log(`Window start: ${new Date(requestData.windowStart).toISOString()}`);
  console.log(`Limit: ${REQUESTS_PER_MINUTE} requests per minute`);
  
  // Check if rate limit is exceeded
  return requestData.count <= REQUESTS_PER_MINUTE;
}

// OpenAI interaction helper
async function getSearchStrategies(question) {
  try {
    console.log('\n[OpenAI] Sending request to OpenAI...');
    
    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "system",
          content: "Provide a JSON response to sugeest at least 3 options, each a website and search terms to fact-check the questions. Use this format: [{\"source\": \"ExampleWebsite\", \"searchTerms\": [\"ExampleTerm1\", \"ExampleTerm2\"]}]"
        }, {
          role: "user",
          content: `Question: Did the White House publish the State of the Union?  
          [{"source": "WhiteHouse.gov", "searchTerms": ["State of the Union"]}];  
          Question: ${question}`
        }],
        temperature: 0.7,
        max_tokens: 500
      });
      
      console.log('\n[OpenAI] Received response from OpenAI');
      
      const strategies = completion?.choices?.[0]?.message?.content
        ? completion.choices[0].message.content
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(strategy => strategy.trim())
        : [];

    return strategies;
    
  } catch (error) {
    console.error('\n[OpenAI Error]', error);
    throw new Error(`Failed to get search strategies: ${error.message}`);
  }
}

// Handle CORS preflight
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

// Main POST handler
export async function POST(request: Request) {
  console.log('\n=== New Request ===');
  const requestStart = Date.now();

  try {
    const corsHeaders = getCorsHeaders(request);

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
            ...corsHeaders
          }
        }
      );
    }

    // Parse request body
    console.log('\n[Body Debug] Parsing request body...');
    const body = await request.json();
    console.log('[Body Debug] Received body:', JSON.stringify(body, null, 2));

    const { question } = body;
    if (!question) {
      console.error('[Validation] Missing required question field');
      return new NextResponse(
        JSON.stringify({ 
          success: false,
          error: "Question is required",
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
            ...corsHeaders
          }
        }
      );
    }

    console.log('\n[Processing] Question:', question);
    
    // Get search strategies from OpenAI
    const strategies = await getSearchStrategies(question);

    const response = {
      success: true,
      question,
      strategies,
      debug: {
        processingTime: Date.now() - requestStart,
        timestamp: new Date().toISOString(),
        ip: ip,
        strategiesCount: strategies.length
      }
    };

    console.log('\n[Response Debug] Sending response:', JSON.stringify(response, null, 2));
    return new NextResponse(
      JSON.stringify(response),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('\n[Error Debug] Full error:', error);
    console.error('[Error Debug] Stack trace:', error.stack);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Failed to process strategy request",
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
          ...corsHeaders
        }
      }
    );
  }
}