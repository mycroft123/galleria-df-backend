const axios = require('axios');

async function getOpenAIResponse(prompt) {
    const apiKey = "sk-proj-8Pb9sIvoulesa5MhDPFOT3BlbkFJokstesNnvr67B38fLBhq"; // Replace with your actual OpenAI API key
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    return response.data.choices[0].message.content;
}

module.exports = { getOpenAIResponse };
