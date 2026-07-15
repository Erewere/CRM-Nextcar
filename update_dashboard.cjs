const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 1. Identify the 'Centro de Atención' block
const actionCenterStart = content.indexOf('        {/* Action Center (Tasks & Alerts) */}');
const actionCenterEnd = content.indexOf('      </div>\n    </div>\n  );\n}\n'); // Adjust end based on structure
if (actionCenterStart === -1) {
  console.log("Could not find Action Center");
  process.exit(1);
}

// Wait, it's inside <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
const grid3ColsStart = content.indexOf('      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">');
const endOfGrid3Cols = content.indexOf('      </div>', actionCenterStart) + '      </div>'.length;

const actionCenterContent = content.substring(actionCenterStart, endOfGrid3Cols - '      </div>'.length);

// Remove the whole grid3Cols block
content = content.substring(0, grid3ColsStart) + content.substring(endOfGrid3Cols);

// 2. Modify Action Center to be horizontal
let modifiedActionCenter = actionCenterContent;
modifiedActionCenter = modifiedActionCenter.replace(
  '<div className="p-5 flex-1 space-y-4">',
  '<div className="p-5 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">'
);
// Remove block class from links
modifiedActionCenter = modifiedActionCenter.replace(/className="block flex/g, 'className="flex flex-col h-full');
// Wait, currently they are: className="block flex items-center justify-between p-3..."
// If we want a card style: className="flex flex-col justify-between p-4 rounded-lg..."
modifiedActionCenter = modifiedActionCenter.replace(
  /className="block flex items-center justify-between p-3/g,
  'className="flex flex-col gap-2 justify-between p-4'
);

// Instead of regex, let's just use the existing but change to flex-col or keep items-center justify-between? 
// If horizontal grid, "flex items-center justify-between" might still work well if the card is wide enough, but flex-col might be better for small cards.
// Let's just change space-y-4 to grid grid-cols-1 md:grid-cols-3 gap-4.

// 3. Insert Action Center before Stat cards
const statCardsStart = content.indexOf('      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">');
content = content.substring(0, statCardsStart) + modifiedActionCenter + '\n' + content.substring(statCardsStart);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Updated Dashboard Layout');
