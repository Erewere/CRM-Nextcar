const fs = require('fs');

function removeDupes(file, searchStr, replaceStr) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(file, content);
}

removeDupes('src/pages/Dashboard.tsx',
  `import { MobileHome } from "./mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileHome } from "./mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";`,
  `import { MobileHome } from "./mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";`
);

removeDupes('src/pages/Inventory.tsx',
  `import { MobileInventory } from "./mobile/MobileInventory";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileInventory } from "./mobile/MobileInventory";
import { useIsMobile } from "../hooks/useIsMobile";`,
  `import { MobileInventory } from "./mobile/MobileInventory";
import { useIsMobile } from "../hooks/useIsMobile";`
);

removeDupes('src/components/Layout.tsx',
  `import { useIsMobile } from "../hooks/useIsMobile";
import { useIsMobile } from "../hooks/useIsMobile";`,
  `import { useIsMobile } from "../hooks/useIsMobile";`
);

console.log('Fixed duplications');
