import { NextResponse } from 'next/server';
import { parseAndAnalyzePage } from '../../../lib/webParser';
import { FACT_EXTRACTION_PROMPT } from '../../../lib/factExtractionPrompt';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3001',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Rate limiting configuration
const REQUESTS_PER_MINUTE = 10;
const requestCounts = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= REQUESTS_PER_MINUTE) {
    return false;
  }
  
  requestCounts.set(ip, [...recentRequests, now]);
  return true;
}

interface FactAnalysis {
  sentence: string;
  explicit_facts: string[];
  implicit_facts: string[];
}

async function extractFactsFromSentence(sentence: string) {
    try {
      const prompt = FACT_EXTRACTION_PROMPT.replace('[TEXT]', sentence);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a precise fact extractor that MUST ALWAYS respond in valid JSON format.
  Even for invalid or empty input, respond with valid JSON containing empty arrays.
  ALWAYS use this exact format, no exceptions:
  {
    "explicit_facts": [],
    "implicit_facts": []
  }
  Never include any other text or explanations outside the JSON.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });
  
      const response = completion.choices[0].message.content;
      
      if (!response || typeof response !== 'string') {
        return { explicit_facts: [], implicit_facts: [] };
      }
  
      try {
        // Handle common formatting issues
        let cleanedResponse = response
          .trim()
          .replace(/^```json\s*/, '')  // Remove markdown JSON markers if present
          .replace(/\s*```$/, '')      // Remove trailing markdown
          .trim();
          
        if (!cleanedResponse.startsWith('{')) {
          console.warn('Invalid JSON response:', response);
          return { explicit_facts: [], implicit_facts: [] };
        }
  
        const parsed = JSON.parse(cleanedResponse);
        
        if (!parsed.explicit_facts || !parsed.implicit_facts || 
            !Array.isArray(parsed.explicit_facts) || !Array.isArray(parsed.implicit_facts)) {
          console.warn('Response missing required arrays');
          return { explicit_facts: [], implicit_facts: [] };
        }
  
        // Validate that facts follow the rules
        const validateFact = (fact: string) => 
          typeof fact === 'string' && 
          fact.length > 0 && 
          !fact.includes('this') && 
          !fact.includes('that incident') && 
          !fact.includes('the event');
  
        return {
          explicit_facts: parsed.explicit_facts.filter(validateFact),
          implicit_facts: parsed.implicit_facts.filter(validateFact)
        };
  
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.error('Raw response:', response);
        return { explicit_facts: [], implicit_facts: [] };
      }
    } catch (error) {
      console.error('Error extracting facts:', error);
      console.error('Problematic sentence:', sentence);
      return { explicit_facts: [], implicit_facts: [] };
    }
}

async function processSentences(content: string): Promise<FactAnalysis[]> {
  if (!content) {
    throw new Error('No content available to process');
  }

  try {
    const sentences = content.split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 20)
      .map(sentence => sentence.trim());

    if (sentences.length === 0) {
      throw new Error('No valid sentences found after processing content');
    }

    const factPromises = sentences.map(async sentence => {
      const facts = await extractFactsFromSentence(sentence);
      return {
        sentence,
        explicit_facts: facts.explicit_facts || [],
        implicit_facts: facts.implicit_facts || []
      };
    });

    const results = await Promise.all(factPromises);
    return results.filter(result => 
      result.explicit_facts.length > 0 || result.implicit_facts.length > 0
    );
  } catch (error) {
    console.error('Error in processSentences:', error);
    throw error;
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { 
          status: 429,
          headers: corsHeaders
        }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    console.log('Processing URL:', url);
    
    const parseResult = await parseAndAnalyzePage(url);
    
    if (!parseResult?.content) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to extract content from URL",
          url 
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const { title, content, metadata } = parseResult;
    const analyzedFacts = await processSentences(content);
    
    const validFacts = analyzedFacts.filter(fact => 
      fact && (fact.explicit_facts.length > 0 || fact.implicit_facts.length > 0)
    );
    
    if (validFacts.length === 0) {
      return NextResponse.json({
        success: false,
        url,
        title,
        metadata,
        error: "No valid facts extracted",
        summary: {
          total_sentences: analyzedFacts.length,
          valid_analyses: 0,
          timestamp: new Date().toISOString()
        }
      }, { 
        headers: corsHeaders 
      });
    }

    return NextResponse.json({
      success: true,
      url,
      title,
      metadata,
      facts: validFacts,
      summary: {
        total_sentences: analyzedFacts.length,
        valid_analyses: validFacts.length,
        timestamp: new Date().toISOString()
      }
    }, { 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error processing article:', error);
    let requestUrl;
    try {
      const body = await request.clone().json();
      requestUrl = body.url;
    } catch {
      requestUrl = undefined;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process article", 
        details: error.message,
        url: requestUrl
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}