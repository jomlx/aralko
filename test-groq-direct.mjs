import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const groqKey = env.match(/VITE_GROQ_API_KEY="(.+?)"/)[1];
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function testGroq() {
  console.log('Testing Groq with model:', GROQ_MODEL);
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: 'Say hello world' }]
    })
  });
  
  if (!res.ok) {
    console.error('Groq Failed:', res.status, await res.text());
  } else {
    const data = await res.json();
    console.log('Groq Succeeded! Response:', data.choices[0].message.content);
  }
}
testGroq();
