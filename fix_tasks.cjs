const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `import { MobileTasks } from "./mobile/MobileTasks";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileTasks } from "./mobile/MobileTasks";
import { useIsMobile } from "../hooks/useIsMobile";`,
  `import { MobileTasks } from "./mobile/MobileTasks";
import { useIsMobile } from "../hooks/useIsMobile";`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx imports');
