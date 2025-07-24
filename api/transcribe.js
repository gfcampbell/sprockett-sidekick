module.exports = (req, res) => {
  res.json({ 
    segments: [{
      speaker: 'Test',
      text: 'API endpoint is working'
    }],
    text: 'API endpoint is working',
    speaker: 'Test',
    timestamp: new Date().toISOString(),
    model: 'test'
  });
}