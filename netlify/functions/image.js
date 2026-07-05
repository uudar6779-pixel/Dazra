exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
    }

    // These environment variables need to be set in your Netlify dashboard
    const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!ACCOUNT_ID || !API_TOKEN) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Cloudflare credentials not configured in Netlify environment variables.' }) 
      };
    }

    // Enhance the prompt for 100% premium quality
    const enhancedPrompt = `${prompt}, masterpiece, best quality, highly detailed, 4k resolution, photorealistic, stunning lighting, sharp focus`;
    const negativePrompt = "blurry, low res, low quality, pixelated, distorted, deformed, ugly, poorly drawn";

    // Using Cloudflare Workers AI - Stable Diffusion XL
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          prompt: enhancedPrompt,
          negative_prompt: negativePrompt
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cloudflare API Error: ${err}`);
    }

    // Convert the binary image response to a Base64 string
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ imageUrl: dataUrl })
    };
  } catch (error) {
    console.error("Image generation error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to generate image" })
    };
  }
};
