// api/ice-servers.js - Vercel API function for ICE server configuration
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Send ICE server configuration with credentials from environment variables
    const iceServers = [
      {
        urls: "stun:stun.relay.metered.ca:80"
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      }
    ];

    res.json({ iceServers });
  } catch (error) {
    console.error('Error providing ICE servers:', error);
    res.status(500).json({ error: 'Failed to provide ICE servers' });
  }
}