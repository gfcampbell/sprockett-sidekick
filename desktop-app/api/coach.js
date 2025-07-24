// api/coach.js - Vercel API function for OpenAI GPT-4 coaching
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'AI coaching unavailable: OpenAI API key not configured'
      });
    }

    // Validate request body
    const { messages, model = 'gpt-4-turbo-preview', max_tokens = 150, temperature = 0.7, stream = true } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    console.log(`🤖 AI Coaching request: ${messages.length} messages, model: ${model}`);

    // Call OpenAI Chat Completion API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
        stream
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI Chat API error (${response.status}):`, errorText);
      
      return res.status(response.status).json({ 
        error: `AI coaching unavailable: API error ${response.status}`,
        details: errorText
      });
    }

    // Set headers for streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Stream the response back to client
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
          res.end();
        } catch (streamError) {
          console.error('Streaming error:', streamError);
          res.end();
        }
      }
      
      console.log(`✅ AI Coaching response streaming started`);
    } else {
      // Non-streaming response
      const result = await response.json();
      console.log(`✅ AI Coaching response: "${result.choices[0]?.message?.content?.substring(0, 100)}..."`);
      res.json(result);
    }

  } catch (error) {
    console.error('❌ AI Coaching error:', error);
    res.status(500).json({ 
      error: 'AI coaching unavailable: Internal server error',
      message: error.message
    });
  }
}