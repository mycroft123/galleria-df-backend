const ALLOWED_ORIGINS = [
    'http://localhost:3001',
    'https://galleria-df.vercel.app',
];

const getCorsHeaders = (req: Request) => {
    const origin = req.headers.get('origin'); // Use 'get' to access headers in Request
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin || '');

    return {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
    };
};

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: Request) {
    const corsHeaders = getCorsHeaders(request); // Generate headers dynamically
    return new Response(null, {
        headers: corsHeaders,
        status: 204, // No content for OPTIONS preflight
    });
}

import { isValidFact } from './validation';

/**
 * Main POST handler for batch NFT creation
 * @param request Incoming HTTP request
 * @returns NextResponse with operation results
 */
export async function POST(request: Request) {
    try {
        const corsHeaders = getCorsHeaders(request); // Generate headers dynamically
        const body = await request.json();
        const { facts } = body;

        if (!Array.isArray(facts)) {
            return new Response(JSON.stringify({
                success: false,
                message: "Facts array is required",
            }), {
                status: 400,
                headers: corsHeaders, // Use dynamic headers
            });
        }

        // Filter and validate facts
        const validFacts = facts.filter((fact) => {
            const isValid = isValidFact(fact);
            if (!isValid) {
                console.log('Skipping invalid fact:', fact);
            }
            return isValid;
        });

        if (validFacts.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: "No valid facts to process",
                totalReceived: facts.length,
                validFacts: 0,
            }), {
                status: 400,
                headers: corsHeaders, // Use dynamic headers
            });
        }

        console.log(`Processing ${validFacts.length} valid facts out of ${facts.length} total`);
        
        // Process facts in batches
        const allResults: MintResult[] = [];
        const totalBatches = Math.ceil(validFacts.length / BATCH_SIZE);

        for (let i = 0; i < validFacts.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const batch = validFacts.slice(i, i + BATCH_SIZE);
            
            console.log(`Processing batch ${batchNumber} of ${totalBatches}`);
            const batchResults = await processBatch(batch, i);
            allResults.push(...batchResults);
            
            // Add delay between batches if not the last batch
            if (i + BATCH_SIZE < validFacts.length) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        const successfulMints = allResults.filter(r => r.success).length;
        
        // Transfer tokens if any mints were successful
        if (successfulMints > 0) {
            console.log(`Initiating token transfer for ${successfulMints} successful mints...`);
            await transferTokens();
        }

        return new Response(JSON.stringify({
            success: true,
            results: allResults,
            message: "Batch NFT creation completed",
            totalReceived: facts.length,
            validFactsProcessed: validFacts.length,
            successfulMints,
            batchSize: BATCH_SIZE,
            totalBatches: Math.ceil(validFacts.length / BATCH_SIZE),
        }), {
            headers: corsHeaders, // Use dynamic headers
        });
    } catch (error: any) {
        console.error("POST Error:", error);
        const corsHeaders = getCorsHeaders(request); // Ensure headers are generated dynamically for error responses
        return new Response(JSON.stringify({
            success: false,
            message: error.message || "An error occurred",
            error: error.stack,
        }), {
            status: 500,
            headers: corsHeaders, // Use dynamic headers
        });
    }
}
