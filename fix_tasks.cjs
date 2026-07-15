const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

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

content = content.replace('  useEffect(() => {\n    if (location.state?.filterStatus) {\n      setFilterStatus(location.state.filterStatus);\n    }\n    if (location.state?.filterDate) {\n      setFilterDate(location.state.filterDate);\n    }\n    if (location.state?.filterType) {\n      setFilterType(location.state.filterType);\n    }\n  }, [location.state]);', '');

const injectionPoint = '  // --- Drag & Drop for Calendar ---';
content = content.replace(injectionPoint, effectStr + '\n\n' + injectionPoint);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx');
