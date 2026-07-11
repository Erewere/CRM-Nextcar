const fs = require('fs');
let code = fs.readFileSync('src/pages/ClosedSales.tsx', 'utf8');

code = code.replace(
  'let clientsQ = query(collection(db, "clients"), where("status", "==", "won"));',
  'let clientsQ = query(collection(db, "clients"));'
);

code = code.replace(
  'clientsQ = query(collection(db, "clients"), where("agencyId", "==", userData.agencyId), where("status", "==", "won"));',
  'clientsQ = query(collection(db, "clients"), where("agencyId", "==", userData.agencyId));'
);

code = code.replace(
  'const wonClients = clients.filter(c => c.status === "won");',
  `const wonKeywords = ["ganado", "won", "vendid", "cerrad"];
  const isWon = (status: string = "") => wonKeywords.some(k => String(status || "").toLowerCase().includes(k));
  const wonClients = clients.filter(c => isWon(c.status));`
);

fs.writeFileSync('src/pages/ClosedSales.tsx', code);
