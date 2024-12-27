// src/app/api/batch-create-nft/route.ts

import { NextResponse } from 'next/server';
import { POST as transferTokens } from '../send-transaction/route';

// CORS Configuration
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours cache for preflight requests
};

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: Request) {
    return NextResponse.json({}, {
        headers: CORS_HEADERS,
    });
}

/**
 * Configuration Constants
 */
const HELIUS_RPC_URL = "https://devnet.helius-rpc.com/?api-key=791504b1-03a1-4fb9-b9df-25ad2e99d16f";
const BATCH_SIZE = 5; // Process facts in smaller batches
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches
const MAX_RETRIES = 3; // Maximum number of retry attempts for failed mints
const RETRY_DELAY = 1000; // 1 second delay between retries

/**
 * Image mapping for different NFT variations
 */
const COLOR_TO_IMAGE_MAP: { [key: string]: string } = {
    blue: "https://rim3qi36iu6y55tmt77rm7w3ved7cpdjjrhty2kl3tplkez3drmq.arweave.net/ihm4I35FPY72bJ__Fn7bqQfxPGlMTzxpS9zetRM7HFk",
    yellow: "https://w6hav65sf2mc3do4yxsgex3rfupnngahqfibv7lphwvgisf7cfua.arweave.net/t44K-7IumC2N3MXkYl9xLR7WmAeBUBr9bz2qZEi_EWg",
    orange: "https://z325ctfzpasszfceuep3x4mv33dncyszsb2gcbg67rjljiguchba.arweave.net/zvXRTLl4JSyURKEfu_GV3sbRYlmQdGEE3vxStKDUEcI",
    purple: "https://vcbkxb2o4tbqmi3watpcr7smrk3sviqiibvqbzj443qxh7ltgzbq.arweave.net/qIKrh07kwwYjdgTeKP5MircqoghAawDlPObhc_1zNkM",
    green: "https://imauscty4e4ddllrj32jcna2gei5xpgigjxgplkbugqoceyo2j2q.arweave.net/QwFJCnjhODGtcU70kTQaMRHbvMgybmetQaGg4RMO0nU",
    red: "https://tczw6pw6uivwwld5pas5bfaxcjhd5ssfndhu6eoqynggvehj2aua.arweave.net/mLNvPt6iK2ssfXgl0JQXEk4-ykVoz08R0MNMapDp0Cg"
};

const DEFAULT_IMAGE = "https://rim3qi36iu6y55tmt77rm7w3ved7cpdjjrhty2kl3tplkez3drmq.arweave.net/ihm4I35FPY72bJ__Fn7bqQfxPGlMTzxpS9zetRM7HFkk";

/**
 * Type Definitions
 */
interface FactData {
    fact: string;
    sourceUrl: string;
    extractedDate: string;
}

interface MintResult {
    success: boolean;
    fact: string;
    sourceUrl?: string;
    extractedDate?: string;
    assetId?: string;
    error?: string;
}

interface NFTMetadata {
    name: string;
    symbol: string;
    description: string;
    attributes: Array<{
        trait_type: string;
        value: string;
    }>;
    imageUrl: string;
    external_url: string;
}

/**
 * Validates fact data structure and content
 * @param fact The fact data to validate
 * @returns boolean indicating if the fact is valid
 */
function isValidFact(fact: FactData): boolean {
    return (
        typeof fact.fact === 'string' &&
        fact.fact.trim().length >= 10 && // Minimum length for a meaningful fact
        typeof fact.sourceUrl === 'string' &&
        fact.sourceUrl.trim().length > 0 &&
        typeof fact.extractedDate === 'string' &&
        !isNaN(Date.parse(fact.extractedDate))
    );
}

/**
 * Handles the minting of a compressed NFT through Helius
 * @param metadata NFT metadata for minting
 * @returns Promise resolving to the asset ID
 */
async function mintCompressedNftHelius(metadata: NFTMetadata): Promise<string> {
    try {
        const rpcRequest = {
            jsonrpc: '2.0',
            id: 'helius-test',
            method: 'mintCompressedNft',
            params: {
                name: metadata.name,
                symbol: metadata.symbol,
                owner: "ExK2ZcWx6tpVe5xfqkHZ62bMQNpStLj98z2WDUWKUKGp",
                description: metadata.description,
                attributes: metadata.attributes,
                imageUrl: metadata.imageUrl,
                externalUrl: metadata.external_url,
                sellerFeeBasisPoints: 0
            }
        };

        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(rpcRequest)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseBody = await response.text();
        const parsedResponse = JSON.parse(responseBody);
        const { result, error } = parsedResponse;

        if (result?.assetId) {
            console.log("Minted asset:", result.assetId);
            return result.assetId;
        } else {
            throw new Error(error?.message || "Failed to mint compressed NFT.");
        }
    } catch (error) {
        console.error("Error during Helius Mint API request:", error);
        throw error;
    }
}

/**
 * Processes a batch of facts for minting
 * @param facts Array of facts to process
 * @param startIndex Starting index for the batch
 * @returns Promise resolving to array of mint results
 */
async function processBatch(facts: FactData[], startIndex: number): Promise<MintResult[]> {
    const results: MintResult[] = [];
    
    for (const factData of facts) {
        try {
            const imageUrl = COLOR_TO_IMAGE_MAP['blue'] || DEFAULT_IMAGE;
            
            const metadata: NFTMetadata = {
                name: `DeFacto Fact #${startIndex + results.length + 1}`,
                symbol: "DFCT",
                description: factData.fact.trim(),
                attributes: [
                    {
                        trait_type: "Type",
                        value: "Fact"
                    },
                    {
                        trait_type: "Source URL",
                        value: factData.sourceUrl.trim()
                    },
                    {
                        trait_type: "Extraction Date",
                        value: factData.extractedDate
                    }
                ],
                imageUrl: imageUrl,
                external_url: `https://yourwebsite.com/facts/${encodeURIComponent(factData.fact)}`
            };

            let assetId: string | null = null;
            let retries = MAX_RETRIES;
            
            while (retries > 0 && !assetId) {
                try {
                    assetId = await mintCompressedNftHelius(metadata);
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    console.log(`Retry attempt ${MAX_RETRIES - retries} for fact at index ${startIndex + results.length}`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }

            results.push({
                success: true,
                fact: factData.fact,
                sourceUrl: factData.sourceUrl,
                extractedDate: factData.extractedDate,
                assetId: assetId!
            });
        } catch (error: any) {
            results.push({
                success: false,
                fact: factData.fact,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Main POST handler for batch NFT creation
 * @param request Incoming HTTP request
 * @returns NextResponse with operation results
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { facts } = body;

        if (!Array.isArray(facts)) {
            return NextResponse.json(
                { success: false, message: "Facts array is required" },
                { 
                    status: 400,
                    headers: CORS_HEADERS
                }
            );
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
            return NextResponse.json(
                { 
                    success: false, 
                    message: "No valid facts to process",
                    totalReceived: facts.length,
                    validFacts: 0
                },
                { 
                    status: 400,
                    headers: CORS_HEADERS
                }
            );
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
            const transferResponse = await transferTokens();
        }

        return NextResponse.json({
            success: true,
            results: allResults,
            message: "Batch NFT creation completed",
            totalReceived: facts.length,
            validFactsProcessed: validFacts.length,
            successfulMints,
            batchSize: BATCH_SIZE,
            totalBatches: Math.ceil(validFacts.length / BATCH_SIZE)
        }, {
            headers: CORS_HEADERS
        });
    } catch (error: any) {
        console.error("POST Error:", error);
        return NextResponse.json(
            { 
                success: false, 
                message: error.message || "An error occurred",
                error: error.stack
            },
            { 
                status: 500,
                headers: CORS_HEADERS
            }
        );
    }
}