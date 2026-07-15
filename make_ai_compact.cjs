const fs = require('fs');
let content = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

content = content.replace(/className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-xl shadow-lg border border-indigo-500\/30 overflow-hidden text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500"/g,
  'className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 rounded-lg shadow border border-indigo-500/30 overflow-hidden text-white mb-4"');

content = content.replace(/className="p-3 sm:p-4 flex items-center justify-between bg-black\/20 cursor-pointer hover:bg-black\/30 transition-colors"/g,
  'className="p-2 sm:p-3 flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"');

content = content.replace(/className="p-1\.5 sm:p-2 bg-indigo-500\/20 rounded-lg border border-indigo-500\/30 shadow-inner"/g,
  'className="p-1 sm:p-1.5 bg-indigo-500/20 rounded-md border border-indigo-500/30 shadow-inner"');

content = content.replace(/<Bot className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300" \/>/g,
  '<Bot className="w-4 h-4 text-indigo-300" />');

content = content.replace(/<h3 className="text-sm sm:text-base font-bold text-white tracking-wide">IA Erewere<\/h3>/g,
  '<h3 className="text-sm font-bold text-white tracking-wide">IA Erewere</h3>');

content = content.replace(/<p className="text-xs text-indigo-200\/80">Asesor: <span className="text-indigo-100 font-medium">\{userName\.split\(' '\)\[0\]\}<\/span> • Prospectos activos: \{activeContacts\.length\}<\/p>/g,
  '<p className="text-[10px] text-indigo-200/80">Asesor: <span className="text-indigo-100 font-medium">{userName.split(\' \')[0]}</span> • {activeContacts.length} activos</p>');

content = content.replace(/<button([^>]*)className="hidden sm:flex items-center gap-2 text-\[10px\] sm:text-xs bg-indigo-600 hover:bg-indigo-500 border border-indigo-400\/50 px-2 sm:px-3 py-1 sm:py-1\.5 rounded-full text-white transition-colors cursor-pointer shadow-sm"/g,
  '<button$1className="hidden sm:flex items-center gap-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 px-2 py-1 rounded-full text-white transition-colors cursor-pointer shadow-sm"');

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', content);
console.log('Made AI panel more compact');
