const fs = require('fs');
let content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

content = content.replace(
  `import { MobileInventory } from './mobile/MobileInventory';
import { useIsMobile } from '../hooks/useIsMobile';
import { MobileInventory } from './mobile/MobileInventory';
import { useIsMobile } from '../hooks/useIsMobile';`,
  `import { MobileInventory } from './mobile/MobileInventory';
import { useIsMobile } from '../hooks/useIsMobile';`
);

fs.writeFileSync('src/pages/Inventory.tsx', content);
console.log('Fixed Inventory.tsx imports');
