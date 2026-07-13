const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const routeMatch = `app.post("/api/ai-advisor"`;
if (code.indexOf(routeMatch) !== -1) {
  // extract the entire block
  const start = code.indexOf(routeMatch);
  const end = code.indexOf('app.listen(PORT, "0.0.0.0"');
  
  const routeBlock = code.substring(start, end);
  code = code.substring(0, start) + code.substring(end);
  
  // change model to 2.5 flash
  const fixedRouteBlock = routeBlock.replace(/"gemini-3\.5-flash"/g, '"gemini-2.5-flash"');
  
  // insert before // === Vite Middleware for development ===
  const insertTarget = '// === Vite Middleware for development ===';
  code = code.replace(insertTarget, fixedRouteBlock + '\n  ' + insertTarget);
  
  fs.writeFileSync('server.ts', code);
  console.log("Fixed server route");
}
