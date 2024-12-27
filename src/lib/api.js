// src/lib/api.js
export async function analyzeArticle(url) {
    try {
      const response = await fetch('/api/ai-fact-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing article:', error);
      throw error;
    }
  }