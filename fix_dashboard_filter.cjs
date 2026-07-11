const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regex = /      if \(filterStartDate\) \{\n        const clientDate = c\.createdAt\?\.toDate\n          \? c\.createdAt\.toDate\(\)\n          : new Date\(c\.createdAt \|\| Date\.now\(\)\);\n        const startDate = new Date\(filterStartDate\);\n        if \(\n          isValid\(startDate\) &&\n          isValid\(clientDate\) &&\n          isAfter\(startOfDay\(startDate\), clientDate\)\n        \)\n          return false;\n      \}\n      if \(filterEndDate\) \{\n        const clientDate = c\.createdAt\?\.toDate\n          \? c\.createdAt\.toDate\(\)\n          : new Date\(c\.createdAt \|\| Date\.now\(\)\);\n        const endDate = new Date\(filterEndDate\);\n        if \(\n          isValid\(endDate\) &&\n          isValid\(clientDate\) &&\n          isAfter\(clientDate, startOfDay\(endDate\)\)\n        \)\n          return false;\n      \}/;

const replacement = `      const isWonClient = ["ganado", "won", "vendid", "cerrad"].some(k => String(c.status || "").toLowerCase().includes(k));
      const clientDate = isWonClient && c.soldAt ? new Date(c.soldAt + "T00:00:00") : (c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now()));

      if (filterStartDate) {
        const startDate = new Date(filterStartDate);
        if (isValid(startDate) && isValid(clientDate) && isAfter(startOfDay(startDate), clientDate)) return false;
      }
      if (filterEndDate) {
        const endDate = new Date(filterEndDate);
        if (isValid(endDate) && isValid(clientDate) && isAfter(clientDate, startOfDay(endDate))) return false;
      }`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
