const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const startStr = '          <div className={`flex flex-wrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto ${showMobileFilters ? \'flex\' : \'hidden lg:flex\'}`}>\n';
const endStr = '        </Link>';

const startIndex = content.indexOf(startStr);
const gridIndex = content.indexOf('      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">');

if (startIndex !== -1 && gridIndex !== -1) {
  const replacement = '      </div>\n\n' + content.substring(gridIndex);
  content = content.substring(0, startIndex) + replacement;
  fs.writeFileSync('src/pages/Dashboard.tsx', content);
  console.log('Removed secondary filters from Dashboard.tsx');
} else {
  console.log('Could not find markers', startIndex, gridIndex);
}
