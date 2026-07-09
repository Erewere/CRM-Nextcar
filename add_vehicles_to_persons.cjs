const fs = require('fs');
let code = fs.readFileSync('src/pages/Persons.tsx', 'utf8');

// Add vehicles state
code = code.replace(/const \[persons, setPersons\] = useState<Client\[\]>\(\[\]\);/, `const [persons, setPersons] = useState<Client[]>([]);\n  const [vehicles, setVehicles] = useState<Vehicle[]>([]);`);

// Fetch vehicles
const replaceFetch = `      let clientsDocs: any[] = [];
      let dealsDocs: any[] = [];
      let tasksDocs: any[] = [];
      let vehiclesDocs: any[] = [];

      const uq = query(
        collection(db, "users"),
        where("agencyId", "==", userData.agencyId),
      );
      const vq = query(
        collection(db, "vehicles"),
        where("agencyId", "==", userData.agencyId),
      );`;

code = code.replace(/      let clientsDocs: any\[\] = \[\];\n      let dealsDocs: any\[\] = \[\];\n      let tasksDocs: any\[\] = \[\];\n      const uq = query\(\n        collection\(db, "users"\),\n        where\("agencyId", "==", userData\.agencyId\),\n      \);/, replaceFetch);

const replacePromise1 = `          const [csnap1, csnap2, dsnap, tsnap, vsnap] = await Promise.all([
            getDocs(cq1),
            getDocs(cq2),
            getDocs(dq1).catch(() => ({ docs: [] }) as any),
            getDocs(tq1).catch(() => ({ docs: [] }) as any),
            getDocs(vq).catch(() => ({ docs: [] }) as any),
          ]);
          vehiclesDocs = vsnap.docs;`;

code = code.replace(/          const \[csnap1, csnap2, dsnap, tsnap\] = await Promise\.all\(\[\n            getDocs\(cq1\),\n            getDocs\(cq2\),\n            getDocs\(dq1\)\.catch\(\(\) => \(\{ docs: \[\] \}\) as any\),\n            getDocs\(tq1\)\.catch\(\(\) => \(\{ docs: \[\] \}\) as any\),\n          \]\);/, replacePromise1);

const replacePromise2 = `          const [snap, dSnap, tSnap, vSnap] = await Promise.all([
            getDocs(q),
            getDocs(dq).catch(() => ({ docs: [] }) as any),
            getDocs(tq).catch(() => ({ docs: [] }) as any),
            getDocs(vq).catch(() => ({ docs: [] }) as any),
          ]);
          clientsDocs = snap.docs;
          dealsDocs = dSnap.docs;
          tasksDocs = tSnap.docs;
          vehiclesDocs = vSnap.docs;`;

code = code.replace(/          const \[snap, dSnap, tSnap\] = await Promise\.all\(\[\n            getDocs\(q\),\n            getDocs\(dq\)\.catch\(\(\) => \(\{ docs: \[\] \}\) as any\),\n            getDocs\(tq\)\.catch\(\(\) => \(\{ docs: \[\] \}\) as any\),\n          \]\);\n          clientsDocs = snap\.docs;\n          dealsDocs = dSnap\.docs;\n          tasksDocs = tSnap\.docs;/, replacePromise2);

const setVehiclesCode = `        setDeals(
          dealsDocs
            ? dealsDocs.map((d: any) => ({ id: d.id, ...d.data() }) as Deal)
            : [],
        );
        setVehicles(
          vehiclesDocs.map((d: any) => ({ id: d.id, ...d.data() }) as Vehicle)
        );`;

code = code.replace(/        setDeals\(\n          dealsDocs\n            \? dealsDocs\.map\(\(d: any\) => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\) as Deal\)\n            : \[\],\n        \);/, setVehiclesCode);

fs.writeFileSync('src/pages/Persons.tsx', code);
