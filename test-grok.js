import dotenv from 'dotenv';
dotenv.config();

async function testGrok() {
  const apiKey = process.env.Grok_API;
  console.log('Testing with API key:', apiKey ? (apiKey.substring(0, 10) + '...') : 'undefined');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    console.log('Sending request to Groq API...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('Response status received:', response.status);
    const data = await response.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Fetch error:', error);
  }
}

testGrok();
