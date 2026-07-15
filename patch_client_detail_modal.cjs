const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

// Add state
content = content.replace(
  `  const [activeTab, setActiveTab] = useState("historial");`,
  `  const [activeTab, setActiveTab] = useState("historial");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });`
);

// Add useEffect to fetch it
content = content.replace(
  `  useEffect(() => {
    if (!isOpen || !client) return;`,
  `  useEffect(() => {
    const fetchAgencyConfig = async () => {
      if (userData?.agencyId && userData.agencyId !== 'unassigned') {
        try {
          const snap = await getDoc(doc(db, "agencies", userData.agencyId));
          if (snap.exists() && snap.data().businessHours) {
            const bh = snap.data().businessHours;
            setBusinessHours({
              start: parseInt(bh.start.split(":")[0], 10),
              end: parseInt(bh.end.split(":")[0], 10)
            });
          }
        } catch (e) {
          console.error("Error fetching agency config in modal:", e);
        }
      }
    };
    if (isOpen) {
      fetchAgencyConfig();
    }
  }, [userData, isOpen]);

  useEffect(() => {
    if (!isOpen || !client) return;`
);

// Pass to TimeSelect
content = content.replace(
  `                          <TimeSelect
                            value={newTaskTime}
                            onChange={(val) => setNewTaskTime(val)}
                            placeholder="h:mm"
                          />`,
  `                          <TimeSelect
                            value={newTaskTime}
                            onChange={(val) => setNewTaskTime(val)}
                            placeholder="h:mm"
                            minHour={businessHours.start}
                            maxHour={businessHours.end}
                          />`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
console.log('Fixed ClientDetailModal.tsx');
