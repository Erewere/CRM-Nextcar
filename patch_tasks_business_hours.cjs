const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// Replace the single getDoc with onSnapshot for agency business hours
content = content.replace(
  /const fetchAgencyConfig = async \(\) => \{[\s\S]*?fetchAgencyConfig\(\);\n  \}, \[userData\]\);/,
  `useEffect(() => {
    if (!userData || userData.role === "master") return;
    
    if (userData.agencyId && userData.agencyId !== "unassigned") {
      const agencyRef = doc(db, "agencies", userData.agencyId);
      const unsubscribe = onSnapshot(agencyRef, (snap) => {
        if (snap.exists() && snap.data().businessHours) {
          const bh = snap.data().businessHours;
          setBusinessHours({
            start: parseInt(bh.start.split(":")[0], 10),
            end: parseInt(bh.end.split(":")[0], 10)
          });
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);`
);

content = content.replace(
  'import { AnimatePresence } from "motion/react";',
  'import { AnimatePresence } from "motion/react";\nimport { onSnapshot } from "firebase/firestore";'
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx to use onSnapshot for business hours');
