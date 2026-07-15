const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  const searchPattern = /const fetchAgencyConfig = async \(\) => \{[\s\S]*?fetchAgencyConfig\(\);\n  \}, \[userData\]\);/;
  
  if (content.match(searchPattern)) {
    content = content.replace(
      searchPattern,
      `useEffect(() => {
    if (!userData || userData.role === "master") return;
    
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
  }, [userData]);`
    );
    
    if (!content.includes('import { onSnapshot')) {
      content = content.replace('import { getDoc', 'import { getDoc, onSnapshot');
    }
    
    fs.writeFileSync(file, content);
    console.log('Patched ' + file);
  } else {
    console.log('Pattern not found in ' + file);
  }
}

patchFile('src/components/NewActivityModal.tsx');
