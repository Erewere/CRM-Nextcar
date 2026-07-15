const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

// Fix the duplicated button section
const duplicatePattern = /\{\s*isExpanded \? <ChevronUp[^>]+> : <ChevronDown[^>]+>\s*\}\s*<\/div>\s*\)\s*:\s*\(\s*<button onClick=\{handleAnalyzeWithAI\}[^>]+>[\s\S]*?<\/button>\s*\)\}\s*<\/div>/g;

content = content.replace(duplicatePattern, '{isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-300 ml-2" /> : <ChevronDown className="w-5 h-5 text-indigo-300 ml-2" />}</div>');

// Fix the header styling that didn't get patched correctly in the return
content = content.replace(
  /<div className="p-4 border-b border-white\/10 flex items-center justify-between bg-black\/20">/g,
  `<div 
        className="p-3 sm:p-4 flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >`
);

// Fix the icon sizing
content = content.replace(
  /<div className="p-2 bg-indigo-500\/20 rounded-lg border border-indigo-500\/30 shadow-inner">\s*<Bot className="w-5 h-5 text-indigo-300" \/>/g,
  `<div className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300" />`
);

// Fix the title text sizing
content = content.replace(
  /<h3 className="text-base font-bold text-white tracking-wide">IA Erewere<\/h3>/g,
  `<h3 className="text-sm sm:text-base font-bold text-white tracking-wide">IA Erewere</h3>`
);

// Add missing isExpanded condition to empty state content
content = content.replace(
  /<div className="p-5 flex flex-col items-center justify-center text-center py-8">/,
  `{isExpanded && (<div className="p-5 flex flex-col items-center justify-center text-center py-8">`
);

content = content.replace(
  /<\/p>\s*<\/div>\s*<\/div>\s*\);\s*\}/,
  `</p>\n        </div>\n        )}\n      </div>\n    );\n  }`
);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
console.log('Cleaned AiAdvisorPanel.tsx');
