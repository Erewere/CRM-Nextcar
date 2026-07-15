const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

// Insert useEffect after useState
content = content.replace(
  `  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });`,
  `  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });
  
  useEffect(() => {
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
  // It imports other stuff from firestore, let's find getDoc or just inject it
  content = content.replace('import { getDocs', 'import { getDocs, onSnapshot');
} else {
  // ensure it has onSnapshot if it already has the import but not onSnapshot
  // wait, the import in ClientDetailModal.tsx:
}

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
console.log('Fixed ClientDetailModal.tsx businessHours');
