const cheerio = require('cheerio');
const axios = require('axios');

async function parseAndAnalyzePage(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();
        $('.advertisement').remove();
        $('.social-share').remove();
        $('.related-stories').remove();

        // Extract main content
        let content = '';
        
        // Try to find main content container
        const contentSelectors = [
            'article',
            '.article-body',
            '.story-body',
            '.main-content',
            '[role="main"]',
            '.post-content',
            '.content'
        ];

        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length) {
                content = element.text();
                break;
            }
        }

        // If no main content container found, fallback to paragraphs
        if (!content) {
            content = $('p').map((_, el) => $(el).text().trim())
                           .get()
                           .filter(text => text.length > 50)
                           .join('\n');
        }

        // Clean the content
        content = content
            .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
            .replace(/\n+/g, '\n')   // Replace multiple newlines with single newline
            .trim();

        return {
            content: content,
            title: $('title').text().trim(),
            metadata: {
                description: $('meta[name="description"]').attr('content') || '',
                author: $('meta[name="author"]').attr('content') || '',
                publishDate: $('meta[name="publish-date"]').attr('content') || 
                           $('meta[property="article:published_time"]').attr('content') || ''
            }
        };

    } catch (error) {
        console.error('Error fetching or parsing webpage:', {
            url,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = { parseAndAnalyzePage };