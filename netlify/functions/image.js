exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, imageBytes } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
    }

    const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!ACCOUNT_ID || !API_TOKEN) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Cloudflare credentials not configured in Netlify environment variables.' }) 
      };
    }

    const enhancedPrompt = `${prompt}, masterpiece, best quality, highly detailed, 4k resolution, photorealistic, stunning lighting, sharp focus`;
    const negativePrompt = "blurry, low res, low quality, pixelated, distorted, deformed, ugly, poorly drawn";

    let modelId = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
    let payload = {
      prompt: enhancedPrompt,
      negative_prompt: negativePrompt
    };

    // If an image was attached, switch to Img2Img model
    if (imageBytes) {
      modelId = '@cf/runwayml/stable-diffusion-v1-5-img2img';
      // Convert base64 string to an array of integers (Cloudflare API requirement for some models)
      // Actually, Cloudflare REST API accepts an array of numbers for image:
      const binaryString = Buffer.from(imageBytes, 'base64');
      payload.image = Array.from(new Uint8Array(binaryString));
      payload.guidance = 7.5;
      payload.strength = 0.5; // Default strength for modification
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${modelId}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cloudflare API Error: ${err}`);
    }

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
