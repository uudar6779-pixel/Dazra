// netlify/functions/chat.js
// This function runs on Netlify's server, NOT in the browser.
// The Groq API key stays hidden here and is never sent to the client.

const SYS = `You are DAZRA AI, a premium and highly intelligent assistant built by UDARA INSIGHTS. Your creator and lead developer is UDARA RATHNAYAKA. When asked who built you, who your developer is, or who created you, always proudly answer: "My developer is UDARA RATHNAYAKA from UDARA INSIGHTS."

You are fully fluent in both English and Sinhala (සිංහල). When the user writes in Sinhala, respond entirely in clear, correct, natural Sinhala. When they write in English, respond in English. Never mix languages unless the user specifically asks. Use markdown formatting when helpful.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GROQ_API_KEY environment variable is not set on Netlify.' })
    };
  }

  let messages;
  try {
    const body = JSON.parse(event.body || '{}');
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYS }, ...messages],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: (data.error && data.error.message) || 'Groq API error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data.choices[0].message.content })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
