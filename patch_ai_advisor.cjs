const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

if (!content.includes('const [isExpanded, setIsExpanded] = useState(false);')) {
  content = content.replace(
    'const [errorMsg, setErrorMsg] = useState<string | null>(null);',
    'const [errorMsg, setErrorMsg] = useState<string | null>(null);\n  const [isExpanded, setIsExpanded] = useState(false);'
  );
  
  content = content.replace(
    'import { Loader2, Bot, Clock, FileText, CheckCircle, Phone } from "lucide-react";',
    'import { Loader2, Bot, Clock, FileText, CheckCircle, Phone, ChevronDown, ChevronUp } from "lucide-react";'
  );
  
  content = content.replace(
    '<div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">',
    `<div 
        className="p-3 sm:p-4 flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >`
  );
  
  content = content.replace(
    /<div className="flex items-center gap-2">[\s\S]*?<\/div>/,
    `<div className="flex items-center gap-2">
          {isLoading ? (
            <div className="hidden sm:flex items-center gap-2 text-[10px] sm:text-xs bg-indigo-500/20 border border-indigo-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-indigo-200">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-300" /> Analizando...
            </div>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleAnalyzeWithAI(); setIsExpanded(true); }} 
              className="hidden sm:flex items-center gap-2 text-[10px] sm:text-xs bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-white transition-colors cursor-pointer shadow-sm"
            >
              <Bot className="w-3 h-3" /> Analizar con Gemini
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-300 ml-2" /> : <ChevronDown className="w-5 h-5 text-indigo-300 ml-2" />}
        </div>`
  );
  
  content = content.replace(
    '{errorMsg && (',
    '{isExpanded && errorMsg && ('
  );
  
  content = content.replace(
    '<div className="p-5">',
    '{isExpanded && (\n      <div className="p-3 sm:p-5 border-t border-white/10">'
  );
  
  content = content.replace(
    '      </div>\n    </div>\n  );\n}',
    '      </div>\n      )}\n    </div>\n  );\n}'
  );
  
  // Make closed view smaller by adjusting padding
  content = content.replace(
    '<div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">',
    '<div className="p-1.5 sm:p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30 shadow-inner">'
  );
  content = content.replace(
    '<Bot className="w-5 h-5 text-indigo-300" />',
    '<Bot className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300" />'
  );
  content = content.replace(
    '<h3 className="text-base font-bold text-white tracking-wide">IA Erewere</h3>',
    '<h3 className="text-sm sm:text-base font-bold text-white tracking-wide">IA Erewere</h3>'
  );
  
  fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
  console.log('Patched AiAdvisorPanel.tsx');
}
