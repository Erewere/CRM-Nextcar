import fs from 'fs';
import path from 'path';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      // Make things flatter and lighter like Tasks.tsx
      content = content.replace(/rounded-2xl/g, 'rounded');
      content = content.replace(/rounded-xl/g, 'rounded');
      content = content.replace(/rounded-lg/g, 'rounded');
      content = content.replace(/shadow-lg/g, 'shadow-sm');
      content = content.replace(/shadow-md/g, 'shadow-sm');
      content = content.replace(/border-slate-200/g, 'border-gray-200');
      content = content.replace(/border-slate-100/g, 'border-gray-200');
      content = content.replace(/bg-slate-50/g, 'bg-[#f4f5f5]');
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDirectory('./src');
