#!/usr/bin/env node

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testSimple() {
  console.log('🧪 Testing AssemblyAI with 8-second audio buffer...');
  
  const API_URL = 'https://sprockett.app/api/transcribe';
  
  // Create a realistic 8-second audio buffer (128KB like real recordings)
  const audioBuffer = Buffer.alloc(128639, 0); // Same size as real chunks
  
  const formData = new FormData();
  formData.append('audio', audioBuffer, {
    filename: 'test-8sec.webm',
    contentType: 'audio/webm'
  });
  formData.append('speaker', 'Host');
  formData.append('enable_speaker_detection', 'true');
  
  console.log('📤 Sending request...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      timeout: 30000 // 30 second timeout
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Response received in ${elapsed}ms`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success!');
      console.log('Model:', result.model);
      console.log('Text:', result.text || '(empty)');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Error:', response.status);
      const text = await response.text();
      console.log('Response:', text);
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ Failed after ${elapsed}ms`);
    console.log('Error:', error.message);
  }
}

testSimple().catch(console.error);