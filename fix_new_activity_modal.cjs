const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

if (!content.includes('import { getDoc')) {
  content = content.replace(
    `import { Client } from "../types";`,
    `import { Client } from "../types";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";`
  );
}

content = content.replace(
  `  const [clientId, setClientId] = useState(initialData?.clientId || "");`,
  `  const [clientId, setClientId] = useState(initialData?.clientId || "");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });
  const { userData } = useAuth(); // We need userData`
);

content = content.replace(
  `import { Client } from "../types";`,
  `import { Client } from "../types";
import { useAuth } from "../contexts/AuthContext";`
);


content = content.replace(
  `  const [clientName, setClientName] = useState(() => {`,
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
    fetchAgencyConfig();
  }, [userData]);

  const [clientName, setClientName] = useState(() => {`
);

content = content.replace(
  `                    <TimeSelect
                      value={startTime}
                      onChange={setStartTime}
                      placeholder="Inicio"
                    />`,
  `                    <TimeSelect
                      value={startTime}
                      onChange={setStartTime}
                      placeholder="Inicio"
                      minHour={businessHours.start}
                      maxHour={businessHours.end}
                    />`
);

content = content.replace(
  `                    <TimeSelect
                      value={endTime}
                      onChange={setEndTime}
                      placeholder="Fin"
                    />`,
  `                    <TimeSelect
                      value={endTime}
                      onChange={setEndTime}
                      placeholder="Fin"
                      minHour={businessHours.start}
                      maxHour={businessHours.end}
                    />`
);


fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed NewActivityModal.tsx');
