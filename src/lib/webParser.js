import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0'
};

const GENERIC_TERMS = {
  incident: ['event', 'situation', 'incident', 'occurrence'],
  location: ['area', 'site', 'location', 'venue', 'scene'],
  person: ['individual', 'person', 'suspect', 'victim', 'official', 'spokesperson'],
  time: ['then', 'at the time', 'later', 'earlier', 'afterward', 'subsequently']
};

class ContextTracker {
  constructor() {
    this.context = {
      mainSubject: null,
      location: null,
      time: null,
      event: null
    };
    this.previousFacts = [];
  }

  updateContext(sentence) {
    const nameMatch = sentence.match(/\b[A-Z][a-z]+ (?:[A-Z][a-z]+ )?[A-Z][a-z]+\b/);
    const locationMatch = sentence.match(/\bin ([A-Z][a-z]+(,? [A-Z][a-z]+)*)\b/);
    const timeMatch = sentence.match(/\b(?:on|at) ([A-Za-z]+ \d+(?:st|nd|rd|th)?(?:,? \d{4})?)\b/);

    if (nameMatch) this.context.mainSubject = nameMatch[0];
    if (locationMatch) this.context.location = locationMatch[1];
    if (timeMatch) this.context.time = timeMatch[1];
    
    const eventMatch = sentence.match(/\b(?:shooting|attack|incident|ceremony|meeting|rally)\b/i);
    if (eventMatch) this.context.event = eventMatch[0];
  }

  resolveGenericReferences(fact) {
    let resolvedFact = fact;

    for (const [contextType, terms] of Object.entries(GENERIC_TERMS)) {
      terms.forEach(term => {
        const termRegex = new RegExp(`\\b${term}\\b`, 'i');
        if (termRegex.test(fact)) {
          switch (contextType) {
            case 'incident':
              if (this.context.event) {
                resolvedFact = resolvedFact.replace(termRegex, `${this.context.event}`);
              }
              break;
            case 'location':
              if (this.context.location) {
                resolvedFact = resolvedFact.replace(termRegex, `${this.context.location}`);
              }
              break;
            case 'person':
              if (this.context.mainSubject) {
                resolvedFact = resolvedFact.replace(termRegex, `${this.context.mainSubject}`);
              }
              break;
            case 'time':
              if (this.context.time) {
                resolvedFact = resolvedFact.replace(termRegex, `on ${this.context.time}`);
              }
              break;
          }
        }
      });
    }

    if (this.context.mainSubject) {
      resolvedFact = resolvedFact.replace(/\b(?:he|she|they)\b/gi, this.context.mainSubject);
    }

    return resolvedFact;
  }

  addFact(fact) {
    this.previousFacts.push(fact);
  }

  getRelevantContext(sentence) {
    return {
      mainSubject: this.context.mainSubject,
      location: this.context.location,
      time: this.context.time,
      event: this.context.event
    };
  }
}

function splitIntoSentences(text) {
  if (!text) return [];
  
  const prepared = text
    .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
    .replace(/Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Sr\.|Jr\./g, match => match.replace(".", "@"))
    .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
    .replace(/@/g, ".");

  return prepared.split("|")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function analyzeSentence(sentence, contextTracker) {
  contextTracker.updateContext(sentence);

  const factIndicators = {
    numbers: /\d+/,
    dates: /\b\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
    statistics: /\b\d+%|\d+\s*percent\b/i,
    locations: /\b(?:in|at|from|to)\s+[A-Z][a-zA-Z\s]+/,
    measurements: /\b\d+\s*(?:kg|kilometers?|miles?|feet|meters?|cm|mm|tons?)\b/i,
    money: /\$\d+|\d+\s*dollars|\d+\s*USD/i,
    comparisons: /\bmore than\b|\bless than\b|\bgreater than\b|\bfewer than\b/i,
    factualPhrases: /\bis a\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b/i
  };

  const context = contextTracker.getRelevantContext(sentence);
  const resolvedSentence = contextTracker.resolveGenericReferences(sentence);

  const analysis = {
    originalSentence: sentence,
    resolvedSentence,
    context,
    isLikelyFact: false,
    indicators: [],
    confidence: 0,
    category: 'unknown'
  };

  for (const [indicator, pattern] of Object.entries(factIndicators)) {
    if (pattern.test(resolvedSentence)) {
      analysis.indicators.push(indicator);
      analysis.confidence += 0.2;
    }
  }

  if (analysis.indicators.includes('dates')) {
    analysis.category = 'temporal';
  } else if (analysis.indicators.includes('locations')) {
    analysis.category = 'geographical';
  } else if (analysis.indicators.includes('statistics') || analysis.indicators.includes('numbers')) {
    analysis.category = 'statistical';
  } else if (analysis.indicators.includes('money')) {
    analysis.category = 'financial';
  }

  analysis.isLikelyFact = analysis.confidence > 0.3;
  analysis.confidence = Math.min(analysis.confidence, 1);

  if (analysis.isLikelyFact) {
    contextTracker.addFact(resolvedSentence);
  }

  return analysis;
}

async function getCleanContent(document) {
  try {
    const elementsToRemove = [
      'header', 'footer', 'nav', 'aside', '.sidebar', '.menu', '.navigation',
      '.ads', '.advertisement', '#comments', '.social-share', 'script', 'style',
      '.newsletter', '.related-content', '.recommendations'
    ];

    elementsToRemove.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => element.remove());
    });

    const contentSelectors = [
      '.article__content',
      '.article-body',
      '.zn-body__paragraph',
      '.article__main',
      '[data-uri*="article"]',
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content-body',
      'main',
      '#main-content'
    ];

    let mainContent = null;
    
    for (const selector of contentSelectors) {
      mainContent = document.querySelector(selector);
      if (mainContent) break;
    }

    if (!mainContent) {
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .filter(p => {
          const text = p.textContent.trim();
          return text.length > 50 && 
                 !p.closest('header, footer, nav, aside, .ads, .comments, .related-content');
        });
      
      if (paragraphs.length > 0) {
        mainContent = document.createElement('div');
        paragraphs.forEach(p => mainContent.appendChild(p.cloneNode(true)));
      }
    }

    if (!mainContent) {
      throw new Error('No content could be extracted from the page');
    }

    const cleanText = mainContent.textContent
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[""]|['']/g, '"')
      .trim();

    if (!cleanText) {
      throw new Error('Extracted content is empty after cleaning');
    }

    const title = document.querySelector('h1')?.textContent || 
                 document.querySelector('meta[property="og:title"]')?.content ||
                 document.title;

    const metadata = {
      author: document.querySelector('meta[name="author"]')?.content ||
              document.querySelector('meta[property="article:author"]')?.content,
      date: document.querySelector('meta[name="date"]')?.content ||
            document.querySelector('meta[property="article:published_time"]')?.content,
      description: document.querySelector('meta[name="description"]')?.content ||
                  document.querySelector('meta[property="og:description"]')?.content
    };

    return { title, content: cleanText, metadata };
  } catch (error) {
    console.error('Error in getCleanContent:', error);
    throw error;
  }
}

export async function parseAndAnalyzePage(url) {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    if (!html) {
      throw new Error('Empty response received from server');
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;

    const { title, content, metadata } = await getCleanContent(document);

    if (!content) {
      throw new Error('No content could be extracted from the page');
    }

    const contextTracker = new ContextTracker();
    const sentences = splitIntoSentences(content);
    
    sentences.forEach(sentence => contextTracker.updateContext(sentence));
    
    const facts = sentences
      .map(sentence => analyzeSentence(sentence, contextTracker))
      .filter(analysis => analysis.isLikelyFact);

    const factsByCategory = facts.reduce((acc, fact) => {
      if (!acc[fact.category]) {
        acc[fact.category] = [];
      }
      acc[fact.category].push(fact);
      return acc;
    }, {});

    return {
      title,
      content,
      metadata,
      facts: {
        all: facts,
        byCategory: factsByCategory,
        totalCount: facts.length,
        context: contextTracker.context
      }
    };
  } catch (error) {
    console.error('Error in parseAndAnalyzePage:', error);
    throw error;
  }
}