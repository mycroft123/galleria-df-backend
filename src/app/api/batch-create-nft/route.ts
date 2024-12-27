// src/app/api/batch-create-nft/route.ts
import { MintResult } from '@/types/index';
import { processBatch, transferTokens } from '@/lib/nftProcessing';
import { isValidFact } from './validation';

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second

const ALLOWED_ORIGINS = [
    'http://localhost:3001',
    'https://galleria-df.vercel.app',
];

const getCorsHeaders = (request: Request): HeadersInit => {
    const origin = request.headers.get('origin');
    const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

    return {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
};

export async function OPTIONS(request: Request) {
    const corsHeaders = getCorsHeaders(request);
    return new Response(null, {
        headers: corsHeaders,
        status: 204,
    });
}

export async function POST(request: Request) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const body = await request.json();
        const { facts } = body;

        if (!Array.isArray(facts)) {
            return new Response(JSON.stringify({
                success: false,
                message: "Facts array is required",
            }), {
                status: 400,
                headers: corsHeaders,
            });
        }

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
                headers: corsHeaders,
            });
        }

        console.log(`Processing ${validFacts.length} valid facts out of ${facts.length} total`);
        
        const allResults: MintResult[] = [];
        const totalBatches = Math.ceil(validFacts.length / BATCH_SIZE);

        for (let i = 0; i < validFacts.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const batch = validFacts.slice(i, i + BATCH_SIZE);
            
            console.log(`Processing batch ${batchNumber} of ${totalBatches}`);
            // Fixed: Passing correct options object instead of index
            const batchResults = await processBatch(batch, {
                retry: 3,
                timeout: 30000
            });
            allResults.push(...batchResults);
            
            if (i + BATCH_SIZE < validFacts.length) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        const successfulMints = allResults.filter(r => r.success).length;
        
        if (successfulMints > 0) {
            console.log(`Initiating token transfer for ${successfulMints} successful mints...`);
            // Fixed: Added required parameters for transferTokens
            const tokenIds = allResults
                .filter(r => r.success && r.tokenId)
                .map(r => r.tokenId as string);
            await transferTokens(tokenIds, 'FYFtKyhdQ3R2XigMsSpkLHr21pQw1NJm9V1RNcNYR23H'); // Replace with actual destination address
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
            headers: corsHeaders,
        });
    } catch (error: any) {
        console.error("POST Error:", error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || "An error occurred",
            error: error.stack,
        }), {
            status: 500,
            headers: corsHeaders,
        });
    }
}