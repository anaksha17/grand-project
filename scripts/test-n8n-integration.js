// File: scripts/test-n8n-integration.js
// Run this with: node scripts/test-n8n-integration.js

const fetch = require('node-fetch');

async function testFullFlow() {
  console.log('🧪 Testing Mental Health Tracker n8n Integration\n');

  // Test data
  const testMoodData = {
    userId: 'test-user-12345',
    moodText: 'I am feeling really stressed about work today. Everything seems overwhelming.',
    moodState: 'Stressed',
    sentiment: 'Negative (85%)',
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Test n8n webhook directly
    console.log('1️⃣ Testing n8n webhook directly...');
    const webhookUrl = 'http://localhost:5678/webhook/mood-webhook';
    
    const directResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMoodData),
    });

    if (directResponse.ok) {
      const result = await directResponse.json();
      console.log('✅ n8n webhook works directly!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ n8n webhook failed directly');
      console.log('Status:', directResponse.status);
      console.log('Error:', await directResponse.text());
    }

  } catch (error) {
    console.log('❌ n8n webhook direct test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // 2. Test your API trigger endpoint
    console.log('2️⃣ Testing /api/n8n/trigger endpoint...');
    
    const apiResponse = await fetch('http://localhost:3000/api/n8n/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMoodData),
    });

    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('✅ API trigger endpoint works!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ API trigger endpoint failed');
      console.log('Status:', apiResponse.status);
      console.log('Error:', await apiResponse.text());
    }

  } catch (error) {
    console.log('❌ API trigger test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // 3. Test mood logging (which should trigger n8n)
    console.log('3️⃣ Testing mood logging with n8n trigger...');
    
    const moodResponse = await fetch('http://localhost:3000/api/moods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMoodData),
    });

    if (moodResponse.ok) {
      const result = await moodResponse.json();
      console.log('✅ Mood logging works!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Mood logging failed');
      console.log('Status:', moodResponse.status);
      console.log('Error:', await moodResponse.text());
    }

  } catch (error) {
    console.log('❌ Mood logging test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // 4. Test Ollama directly
    console.log('4️⃣ Testing Ollama directly...');
    
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'User feeling stressed: "I am overwhelmed with work". Provide 3 helpful recommendations in 50 words.',
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 100
        }
      }),
    });

    if (ollamaResponse.ok) {
      const result = await ollamaResponse.json();
      console.log('✅ Ollama works!');
      console.log('AI Response:', result.response);
    } else {
      console.log('❌ Ollama failed');
      console.log('Status:', ollamaResponse.status);
      console.log('Error:', await ollamaResponse.text());
    }

  } catch (error) {
    console.log('❌ Ollama test failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // 5. Check n8n status
    console.log('5️⃣ Checking n8n status...');
    
    const statusResponse = await fetch('http://localhost:3000/api/n8n/trigger?test=true');
    
    if (statusResponse.ok) {
      const result = await statusResponse.json();
      console.log('✅ n8n status check works!');
      console.log('Status:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ n8n status check failed');
      console.log('Status:', statusResponse.status);
    }

  } catch (error) {
    console.log('❌ n8n status check failed:', error.message);
  }

  // Final recommendations
  console.log('\n🔍 TROUBLESHOOTING CHECKLIST:');
  console.log('1. Is n8n running? Check: http://localhost:5678');
  console.log('2. Is Ollama running? Check: http://localhost:11434');
  console.log('3. Is your Next.js app running? Check: http://localhost:3000');
  console.log('4. Is MongoDB running and accessible?');
  console.log('5. Are your environment variables set correctly?');
  console.log('6. Is the n8n workflow activated?');
  console.log('7. Check n8n execution logs for detailed error messages');
}

// Run the test
testFullFlow().catch(console.error);