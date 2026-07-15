const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

const searchPattern = /const fetchAgencyConfig = async \(\) => \{[\s\S]*?fetchAgencyConfig\(\);\n    \}\n  \}, \[userData, isOpen\]\);/;

if (content.match(searchPattern)) {
  content = content.replace(
    searchPattern,
    `useEffect(() => {
    if (!userData || userData.role === "master" || !isOpen) return;
    
    if (userData.agencyId && userData.agencyId !== "unassigned") {
      const unsubscribe = onSnapshot(doc(db, "agencies", userData.agencyId), (snap) => {
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
  }, [userData, isOpen]);`
  );
  
  if (!content.includes('import { onSnapshot')) {
    content = content.replace('import { getDoc', 'import { getDoc, onSnapshot');
  }
  
  fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
  console.log('Patched ClientDetailModal.tsx');
} else {
  console.log('Pattern not found');
}
