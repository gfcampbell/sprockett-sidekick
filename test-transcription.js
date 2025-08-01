#!/usr/bin/env node

/**
 * AssemblyAI Transcription Test Suite
 * Tests the current implementation with various scenarios
 */

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const API_URL = 'https://sprockett.app/api/transcribe';

async function testTranscription(testName, audioFile, options = {}) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`📁 Audio file: ${audioFile}`);
  
  try {
    const formData = new FormData();
    
    // Create a minimal test audio buffer (silence)
    const testBuffer = Buffer.alloc(1024 * 10, 0); // 10KB of silence
    formData.append('audio', testBuffer, {
      filename: 'test-audio.webm',
      contentType: 'audio/webm'
    });
    
    // Add test parameters
    formData.append('speaker', options.speaker || 'TestSpeaker');
    formData.append('enable_speaker_detection', options.enable_speaker_detection || 'true');
    
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Success!`);
      console.log(`🎯 Model: ${result.model}`);
      console.log(`💬 Text: "${result.text}"`);
      console.log(`👥 Segments: ${result.segments?.length || 0}`);
      console.log(`🔊 Speakers: ${result.speakers ? Object.keys(result.speakers).length : 0}`);
      
      return { success: true, result, responseTime };
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return { success: false, error: errorText, responseTime };
    }
    
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTestSuite() {
  console.log('🚀 Starting AssemblyAI Test Suite');
  console.log('===============================');
  
  const tests = [
    {
      name: 'Basic Single Speaker',
      options: { speaker: 'Host', enable_speaker_detection: 'false' }
    },
    {
      name: 'Speaker Diarization Enabled', 
      options: { speaker: 'Host', enable_speaker_detection: 'true' }
    },
    {
      name: 'Unknown Speaker',
      options: { speaker: 'Unknown', enable_speaker_detection: 'true' }
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testTranscription(test.name, 'test-audio.webm', test.options);
    results.push({ test: test.name, ...result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';
    console.log(`${status} ${result.test} - ${time}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Results: ${successCount}/${results.length} tests passed`);
}

// Run the test suite
if (require.main === module) {
  runTestSuite().catch(console.error);
}

module.exports = { testTranscription, runTestSuite };