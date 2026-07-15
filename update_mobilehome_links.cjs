const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileHome.tsx', 'utf8');

if (!content.includes('import { useNavigate }')) {
  content = content.replace('import React, { useMemo, useState } from "react";', 'import React, { useMemo, useState } from "react";\nimport { useNavigate } from "react-router";');
}

if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace('const [currentTime] = useState(new Date());', 'const navigate = useNavigate();\n  const [currentTime] = useState(new Date());');
}

const badHTML = `<div className="grid grid-cols-3 gap-3">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 border border-rose-100 dark:border-rose-800/30 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{overdueTasks.length}</span>
            <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider mt-1">Vencidas</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{todayMeetings.length}</span>
            <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mt-1">Citas</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-100 dark:border-amber-800/30 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{todayFollowUps.length}</span>
            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-1">Seguimientos</span>
          </div>
        </div>`;

const goodHTML = `<div className="grid grid-cols-3 gap-3">
          <div 
            onClick={() => navigate('/tasks')}
            className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-3 border border-rose-100 dark:border-rose-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{overdueTasks.length}</span>
            <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider mt-1">Vencidas</span>
          </div>
          <div 
            onClick={() => navigate('/tasks')}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{todayMeetings.length}</span>
            <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mt-1">Citas</span>
          </div>
          <div 
            onClick={() => navigate('/tasks')}
            className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-100 dark:border-amber-800/30 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{todayFollowUps.length}</span>
            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-1">Seguimientos</span>
          </div>
        </div>`;

content = content.replace(badHTML, goodHTML);
fs.writeFileSync('src/pages/mobile/MobileHome.tsx', content);
console.log('Updated');
