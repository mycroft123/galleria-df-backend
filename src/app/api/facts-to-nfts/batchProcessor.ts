// src/app/api/facts-to-nfts/batchProcessor.ts

import OpenAI from 'openai';

interface BatchProcessingConfig {
  batchSize: number;
  maxConcurrentBatches: number;
  delayBetweenBatches: number;
  maxRetries: number;
  maxSentences?: number;  // Added this configuration option
}

interface SentenceBatch {
  sentences: string[];
  startIndex: number;
}

interface FactResult {
  sentence: string;
  explicit_facts: string[];
  implicit_facts: string[];
  error?: string;
}

const DEFAULT_CONFIG: BatchProcessingConfig = {
  batchSize: 1,
  maxConcurrentBatches: 1,
  delayBetweenBatches: 10000,  // 10 seconds between batches
  maxRetries: 5,
  maxSentences: 10  // Default to 10 sentences
};

export class BatchProcessor {
  private openai: OpenAI;
  private config: BatchProcessingConfig;
  
  constructor(openai: OpenAI, config: Partial<BatchProcessingConfig> = {}) {
    this.openai = openai;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async delay(ms: number) {
    console.log(`Waiting for ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    console.log('Delay complete');
  }

  private async processSingleSentence(sentence: string): Promise<FactResult> {
    try {
      console.log('\nProcessing sentence:', sentence.substring(0, 100), '...');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Extract explicit and implicit facts from the given sentence. 
                     Respond in JSON format with explicit_facts and implicit_facts arrays.`
          },
          {
            role: "user",
            content: sentence
          }
        ],
        temperature: 0.1
      });

      console.log('OpenAI API call successful');
      const response = completion.choices[0].message.content;
      
      if (!response) {
        console.warn('Empty response from OpenAI');
        return {
          sentence,
          explicit_facts: [],
          implicit_facts: [],
          error: 'Empty response from OpenAI'
        };
      }

      try {
        const parsed = JSON.parse(response);
        console.log('Successfully parsed response:', {
          explicitFactsCount: parsed.explicit_facts?.length || 0,
          implicitFactsCount: parsed.implicit_facts?.length || 0
        });

        return {
          sentence,
          explicit_facts: parsed.explicit_facts || [],
          implicit_facts: parsed.implicit_facts || []
        };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return {
          sentence,
          explicit_facts: [],
          implicit_facts: [],
          error: 'Failed to parse OpenAI response'
        };
      }
    } catch (error: any) {
      console.error('OpenAI API Error:', {
        message: error.message,
        status: error?.response?.status,
        data: error?.response?.data,
        headers: error?.response?.headers
      });

      throw error;
    }
  }

  private async retryWithBackoff(
    operation: () => Promise<FactResult>,
    retries: number = this.config.maxRetries
  ): Promise<FactResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRateLimit = error?.response?.status === 429;
        const retryAfter = error?.response?.headers?.['retry-after'];
        const waitTime = isRateLimit && retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(Math.pow(2, attempt) * 1000, 30000);

        console.log(`Attempt ${attempt}/${retries} failed:`, {
          isRateLimit,
          suggestedWait: retryAfter,
          actualWait: waitTime / 1000,
          error: error.message
        });

        if (attempt === retries) {
          console.error('All retry attempts failed');
          return {
            sentence: '',
            explicit_facts: [],
            implicit_facts: [],
            error: `Failed after ${retries} attempts: ${error.message}`
          };
        }

        await this.delay(waitTime);
      }
    }

    throw new Error('Unexpected retry loop exit');
  }

  public async processAllSentences(content: string): Promise<FactResult[]> {
    // Split content into sentences
    let sentences = content.split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    // Limit to maxSentences if specified
    if (this.config.maxSentences) {
      sentences = sentences.slice(0, this.config.maxSentences);
      console.log(`Limited to first ${this.config.maxSentences} sentences`);
    }

    console.log(`Processing ${sentences.length} sentences`);
    const results: FactResult[] = [];

    for (let i = 0; i < sentences.length; i++) {
      console.log(`\n=== Processing sentence ${i + 1}/${sentences.length} ===`);
      
      const result = await this.retryWithBackoff(
        () => this.processSingleSentence(sentences[i])
      );
      
      results.push(result);
      
      if (i < sentences.length - 1) {
        console.log(`Waiting ${this.config.delayBetweenBatches}ms before next sentence`);
        await this.delay(this.config.delayBetweenBatches);
      }
    }

    const successfulResults = results.filter(r => !r.error);
    console.log('\nProcessing complete:', {
      totalSentences: sentences.length,
      successfulProcessed: successfulResults.length,
      failedProcessed: results.length - successfulResults.length
    });

    return results;
  }
}