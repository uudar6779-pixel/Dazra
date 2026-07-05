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

    let enhancedPrompt = `${prompt}, masterpiece, ultra-detailed, highly detailed, 4k resolution, hyperrealistic, cinematic lighting, breathtaking, award-winning photography, sharp focus`;
    const negativePrompt = "blurry, low res, low quality, pixelated, distorted, deformed, ugly, poorly drawn, bad anatomy, extra limbs, watermark, artifacts";

    // Use state-of-the-art FLUX model for text-to-image (provides Gemini-level quality)
    let modelId = '@cf/black-forest-labs/flux-1-schnell';
    let payload = {
      prompt: enhancedPrompt,
      num_steps: 4 // FLUX schnell is optimized for 4 steps
    };

    // If an image was attached, switch to Img2Img model
    if (imageBytes) {
      // Cloudflare currently only has SD 1.5 for Img2Img. We heavily tune it for max quality.
      modelId = '@cf/runwayml/stable-diffusion-v1-5-img2img';
      const binaryString = Buffer.from(imageBytes, 'base64');
      payload = {
        prompt: enhancedPrompt,
        negative_prompt: negativePrompt,
        image: Array.from(new Uint8Array(binaryString)),
        guidance: 8.5,
        strength: 0.65, // Strong enough to edit, but keeps original structure
        num_steps: 20 // Max steps for better quality
      };
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

    const contentType = response.headers.get("content-type") || "";
    let base64 = "";

    if (contentType.includes("application/json")) {
      const jsonResponse = await response.json();
      base64 = (jsonResponse.result && jsonResponse.result.image) || "";
      if (!base64) throw new Error("JSON response did not contain an image");
    } else {
      const arrayBuffer = await response.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
    }

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
