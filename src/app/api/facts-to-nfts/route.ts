// src/app/api/facts-to-nfts/route.ts

import { NextResponse } from 'next/server';
import { parseAndAnalyzePage } from '../../../../aiClient';
import OpenAI from 'openai';
import { BatchProcessor } from './batchProcessor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function corsResponse(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS() {
  return corsResponse(new NextResponse(null, { status: 200 }));
}

interface MintedFact {
  mintId: string;
  fact: string;
  sourceUrl: string;
  extractedDate: string;
}

export async function POST(request: Request) {
  console.log('\n=== Starting new request ===\n');
  
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      console.log('Request missing URL');
      return corsResponse(NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      ));
    }

    console.log('Processing URL:', url);
    
    const parseResult = await parseAndAnalyzePage(url);
    
    if (!parseResult?.content) {
      console.log('Failed to extract content from URL');
      return corsResponse(NextResponse.json(
        { success: false, error: "Failed to extract content from URL", url },
        { status: 400 }
      ));
    }

    console.log('Content extracted successfully. Length:', parseResult.content.length);

    const batchProcessor = new BatchProcessor(openai, {
      batchSize: 1,
      maxConcurrentBatches: 1,
      delayBetweenBatches: 10000,
      maxRetries: 5,
      maxSentences: 5
    });

    console.log('Starting batch processing');
    const results = await batchProcessor.processAllSentences(parseResult.content);
    console.log('Batch processing complete');
    
    const allFacts = results.flatMap(result => {
      if (result.error) {
        console.warn('Skipping result with error:', result.error);
        return [];
      }
      return [
        ...result.explicit_facts.map(fact => ({
          fact,
          sourceUrl: url,
          extractedDate: new Date().toISOString()
        })),
        ...result.implicit_facts.map(fact => ({
          fact,
          sourceUrl: url,
          extractedDate: new Date().toISOString()
        }))
      ];
    });

    console.log(`Extracted ${allFacts.length} total facts`);

    if (allFacts.length === 0) {
      console.log('No valid facts extracted');
      return corsResponse(NextResponse.json({
        success: false,
        error: "No valid facts extracted",
        url,
        title: parseResult.title
      }));
    }

    console.log('Sending facts to NFT creation endpoint');
    const nftResponse = await fetch('http://localhost:3002/api/batch-create-nft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facts: allFacts })
    });

    if (!nftResponse.ok) {
      throw new Error(`NFT creation failed: ${await nftResponse.text()}`);
    }

    const rawResponse = await nftResponse.text();
    const nftResults = JSON.parse(rawResponse);

    // Extract both mint IDs and facts
    const mintedFacts: MintedFact[] = nftResults.results
      .filter((result: any) => result.success && result.assetId)
      .map((result: any) => ({
        mintId: result.assetId,
        fact: typeof result.fact === 'string' ? result.fact : result.fact.fact,
        sourceUrl: result.sourceUrl,
        extractedDate: result.extractedDate
      }));

    console.log(`Found ${mintedFacts.length} minted facts`);

    // Get just the mint IDs for backward compatibility
    const mintIds = mintedFacts.map(mf => mf.mintId);

    return corsResponse(NextResponse.json({
      success: true,
      totalFactsProcessed: allFacts.length,
      totalMinted: mintedFacts.length,
      mintIds: mintIds, // Keep the original mintIds array for backward compatibility
      mintedFacts: mintedFacts, // New field with both mint IDs and facts
      processingDetails: {
        url: url,
        title: parseResult.title,
        contentLength: parseResult.content.length,
        factsSent: allFacts.length,
        successfulMints: nftResults.successfulMints,
        totalBatches: nftResults.totalBatches,
        validFactsProcessed: nftResults.validFactsProcessed
      }
    }));

  } catch (error: any) {
    console.error('Error in POST handler:', {
      message: error.message,
      stack: error.stack,
      status: error?.response?.status,
      data: error?.response?.data
    });
    
    return corsResponse(NextResponse.json(
      { 
        success: false, 
        error: "Failed to process request", 
        details: error.message,
        url: body?.url 
      },
      { status: 500 }
    ));
  }
}