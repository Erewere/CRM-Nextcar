const fs = require('fs');

// Patch ClosedSales.tsx
let closedSales = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

const pipelineStagesImport = `import { doc, getDoc } from "firebase/firestore";`;
if (!closedSales.includes("getDoc")) {
  closedSales = closedSales.replace(
    'import { collection, query, where, onSnapshot } from "firebase/firestore";',
    'import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";'
  );
}

const pipelineStagesState = `  const [pipelineStages, setPipelineStages] = useState<{ id: string; title: string }[]>([]);`;
if (!closedSales.includes("pipelineStages")) {
  closedSales = closedSales.replace(
    '  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);',
    '  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);\n' + pipelineStagesState
  );
}

const pipelineStagesFetch = `
    if (userData?.agencyId) {
      getDoc(doc(db, "agencies", userData.agencyId as string))
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pipelineStages && Array.isArray(data.pipelineStages)) {
              setPipelineStages(data.pipelineStages);
            }
          }
        });
    }
`;
if (!closedSales.includes("getDoc(doc(db, ")) {
  closedSales = closedSales.replace(
    '    if (!userData?.agencyId && userData?.role !== \'master\') return;',
    '    if (!userData?.agencyId && userData?.role !== \'master\') return;\n' + pipelineStagesFetch
  );
}

const isWonImpl = `
  const isWon = (status: string = "") => {
    const wonKeywords = ["ganado", "won", "vendid", "cerrad"];
    if (wonKeywords.some(k => String(status || "").toLowerCase().includes(k))) return true;
    
    const stage = pipelineStages.find(s => s.id === status);
    if (stage) {
      const t = String(stage.title || "").toLowerCase();
      const id = String(stage.id || "").toLowerCase();
      return id === "won" || t.includes("ganad") || t.includes("vendid") || t.includes("cerrad") || t.includes("won");
    }
    return false;
  };
`;

closedSales = closedSales.replace(
  /const wonKeywords = \["ganado", "won", "vendid", "cerrad"\];\n\s*const isWon = \(status: string = ""\) => wonKeywords.some\(k => String\(status \|\| ""\)\.toLowerCase\(\)\.includes\(k\)\);/g,
  isWonImpl
);

fs.writeFileSync('src/pages/ClosedSales.tsx', closedSales);

// Now patch Dashboard.tsx
let dashboard = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const isWonDashboard = `
  const isWon = (status: string = "") => {
    const wonKeywords = ["ganado", "won", "vendid", "cerrad"];
    if (wonKeywords.some((k) => String(status || "").toLowerCase().includes(k))) return true;
    const stage = pipelineStages.find(s => s.id === status);
    if (stage) {
      const t = String(stage.title || "").toLowerCase();
      const id = String(stage.id || "").toLowerCase();
      return id === "won" || t.includes("ganad") || t.includes("vendid") || t.includes("cerrad") || t.includes("won");
    }
    return false;
  };
`;

// Dashboard has its own isWon declaration
dashboard = dashboard.replace(
  /  const wonKeywords = \["ganado", "won", "vendid", "cerrad"\];\n\s*const lostKeywords = \["perdid", "lost"\];\n\s*const isWon = \(status: string = ""\) =>\n\s*wonKeywords\.some\(\(k\) =>\n\s*String\(status \|\| ""\)\n\s*\.toLowerCase\(\)\n\s*\.includes\(k\),\n\s*\);/g,
  isWonDashboard + '\n  const lostKeywords = ["perdid", "lost"];'
);

// We must also fix filteredClients where we used isWonClient before!
// Let's replace the block in filteredClients
const filteredClientsFixRegex = /      const isWonClient = \["ganado", "won", "vendid", "cerrad"\]\.some\(k => String\(c\.status \|\| ""\)\.toLowerCase\(\)\.includes\(k\)\);\n\s*const clientDate = isWonClient && c\.soldAt \? new Date\(c\.soldAt \+ "T00:00:00"\) : \(c\.createdAt\?\.toDate \? c\.createdAt\.toDate\(\) : new Date\(c\.createdAt \|\| Date\.now\(\)\)\);/g;

const filteredClientsFixReplacement = `      const isWonClient = isWon(c.status);
      const clientDate = isWonClient && c.soldAt ? new Date(c.soldAt + "T00:00:00") : (c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now()));`;

dashboard = dashboard.replace(filteredClientsFixRegex, filteredClientsFixReplacement);

fs.writeFileSync('src/pages/Dashboard.tsx', dashboard);
