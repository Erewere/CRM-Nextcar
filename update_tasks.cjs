const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('import { useLocation } from "react-router"')) {
  if (content.includes('import { Link } from "react-router";')) {
    content = content.replace('import { Link } from "react-router";', 'import { Link, useLocation } from "react-router";');
  } else {
    content = content.replace('import React, { useEffect, useState, useMemo } from "react";', 'import React, { useEffect, useState, useMemo } from "react";\nimport { useLocation } from "react-router";');
  }
}

const locationHookStr = `  const location = useLocation();`;
if (!content.includes(locationHookStr)) {
  content = content.replace('const [tasks, setTasks] = useState<{ task: Task; client: Client | null }[]>(', locationHookStr + '\n  const [tasks, setTasks] = useState<{ task: Task; client: Client | null }[]>(');
}

const effectStr = `  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatus(location.state.filterStatus);
    }
    if (location.state?.filterDate) {
      setFilterDate(location.state.filterDate);
    }
    if (location.state?.filterType) {
      setFilterType(location.state.filterType);
    }
  }, [location.state]);`;

if (!content.includes('if (location.state?.filterStatus)')) {
  // Insert effect after state initializations
  const injectionPoint = 'const [dragState, setDragState] = useState<{';
  if (content.includes(injectionPoint)) {
     const nextLineIdx = content.indexOf('\n', content.indexOf(injectionPoint)) + 1;
     content = content.slice(0, nextLineIdx) + '\n' + effectStr + '\n' + content.slice(nextLineIdx);
  }
}

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Updated Tasks.tsx');
