import { NextResponse } from 'next/server';
import { parseAndAnalyzePage } from '../../../../aiClient';
import { OpenAI } from 'openai';
import { BatchProcessor } from './batchProcessor';
import { corsHeaders, handleOptions } from '@/lib/cors';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Handle CORS preflight
export const OPTIONS = handleOptions;

interface MintedFact {
  mintId: string;
  fact: string;
  sourceUrl: string;
  extractedDate: string;
}

export async function POST(request: Request) {
  console.log('\n=== Starting new request ===\n');
  
  let body;
  try {
    body = await request.json();
    const { url } = body;

    if (!url) {
      console.log('Request missing URL');
      return new NextResponse(
        JSON.stringify({ error: "URL is required" }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    console.log('Processing URL:', url);
    
    const parseResult = await parseAndAnalyzePage(url);
    
    if (!parseResult?.content) {
      console.log('Failed to extract content from URL');
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: "Failed to extract content from URL", 
          url 
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
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "No valid facts extracted",
          url,
          title: parseResult.title
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
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

    const mintedFacts: MintedFact[] = nftResults.results
      .filter((result: any) => result.success && result.assetId)
      .map((result: any) => ({
        mintId: result.assetId,
        fact: typeof result.fact === 'string' ? result.fact : result.fact.fact,
        sourceUrl: result.sourceUrl,
        extractedDate: result.extractedDate
      }));

    console.log(`Found ${mintedFacts.length} minted facts`);

    const mintIds = mintedFacts.map(mf => mf.mintId);

    return new NextResponse(
      JSON.stringify({
        success: true,
        totalFactsProcessed: allFacts.length,
        totalMinted: mintedFacts.length,
        mintIds: mintIds,
        mintedFacts: mintedFacts,
        processingDetails: {
          url: url,
          title: parseResult.title,
          contentLength: parseResult.content.length,
          factsSent: allFacts.length,
          successfulMints: nftResults.successfulMints,
          totalBatches: nftResults.totalBatches,
          validFactsProcessed: nftResults.validFactsProcessed
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error: any) {
    console.error('Error in POST handler:', {
      message: error.message,
      stack: error.stack,
      status: error?.response?.status,
      data: error?.response?.data
    });
    
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: "Failed to process request", 
        details: error.message,
        url: body?.url 
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