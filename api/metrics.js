// api/metrics.js - Vercel API function for conversation metrics analysis
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
        error: 'Metrics analysis unavailable: OpenAI API key not configured'
      });
    }

    // Validate request body
    const { messages, model = 'gpt-3.5-turbo', max_tokens = 100, temperature = 0.3 } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    console.log(`📊 Metrics analysis request: ${messages.length} messages, model: ${model}`);

    // Call OpenAI Chat Completion API (non-streaming for structured JSON response)
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
        stream: false // Metrics need structured JSON response
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI Chat API error (${response.status}):`, errorText);
      
      return res.status(response.status).json({ 
        error: `Metrics analysis unavailable: API error ${response.status}`,
        details: errorText
      });
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      console.error('❌ No content in metrics response');
      return res.status(500).json({ 
        error: 'Metrics analysis failed: No response content'
      });
    }

    // Try to parse JSON response
    try {
      const metrics = JSON.parse(content.trim());
      
      // Validate metrics structure
      if (typeof metrics.warmth !== 'number' || 
          typeof metrics.energy !== 'number' || 
          typeof metrics.agreeability !== 'number' || 
          typeof metrics.goal_progress !== 'number') {
        throw new Error('Invalid metrics structure');
      }

      console.log(`✅ Metrics analysis response: warmth=${metrics.warmth}, energy=${metrics.energy}, agreeability=${metrics.agreeability}, goal=${metrics.goal_progress}`);
      
      res.json({
        success: true,
        metrics
      });

    } catch (parseError) {
      console.error('❌ Failed to parse metrics JSON:', parseError);
      console.error('Raw content:', content);
      
      // Return default metrics if parsing fails
      res.json({
        success: false,
        error: 'Failed to parse metrics response',
        raw_content: content,
        metrics: {
          warmth: 3,
          energy: 3,
          agreeability: 3,
          goal_progress: 50
        }
      });
    }

  } catch (error) {
    console.error('❌ Metrics analysis error:', error);
    res.status(500).json({ 
      error: 'Metrics analysis unavailable: Internal server error',
      message: error.message
    });
  }
}