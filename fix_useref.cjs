const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileClientDetail.tsx', 'utf8');

content = content.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect, useRef } from 'react';");
if (!content.includes("useRef")) {
  // if it wasn't replaced
  content = content.replace("import { useState, useEffect", "import { useState, useEffect, useRef");
}

fs.writeFileSync('src/pages/mobile/MobileClientDetail.tsx', content);
console.log('Fixed useRef');
