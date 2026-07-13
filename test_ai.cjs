const fs = require('fs');
fetch('http://localhost:3000/api/ai-advisor', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agencyId: "test",
    activeContacts: [],
    tasks: [],
    pipelineStages: []
  })
}).then(res => res.json()).then(console.log).catch(console.error);
