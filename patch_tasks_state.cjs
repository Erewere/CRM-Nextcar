const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `  const [newTaskClientId, setNewTaskClientId] = useState("");`,
  `  const [newTaskClientId, setNewTaskClientId] = useState("");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });`
);

content = content.replace(
  `    const fetchTasksAndClients = async () => {`,
  `    const fetchTasksAndClients = async () => {
      try {
        const agencyRef = doc(db, "agencies", userData.agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists() && agencySnap.data().businessHours) {
          const bh = agencySnap.data().businessHours;
          setBusinessHours({
            start: parseInt(bh.start.split(":")[0], 10),
            end: parseInt(bh.end.split(":")[0], 10)
          });
        }
      } catch(e) { console.error("Error fetching agency config:", e); }`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Added businessHours to Tasks.tsx');
