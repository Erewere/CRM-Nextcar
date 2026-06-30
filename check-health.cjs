const http = require('http');
http.get('http://localhost:3000/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Response:', data); });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
