const fs = require('fs');
let code = fs.readFileSync('src/pages/Kanban.tsx', 'utf8');

const target = `      // we only need to persist to Firebase if the status is different from start
      try {
        await updateDoc(doc(db, "clients", clientId), {
          status: overColumnId,
          updatedAt: new Date().toISOString(),
        });
        // Trigger vehicle status pending validation if moved to "won"
        const overStr = String(overColumnId || "").toLowerCase();
        const isWon =
          overColumnId === "won" ||
          overStr.includes("ganado") ||
          overStr.includes("vendido");
        if (isWon && client.vehicleId) {`;

const replacement = `      // we only need to persist to Firebase if the status is different from start
      try {
        const overStr = String(overColumnId || "").toLowerCase();
        const isWon =
          overColumnId === "won" ||
          overStr.includes("ganado") ||
          overStr.includes("vendido");

        const updates: any = {
          status: overColumnId,
          updatedAt: new Date().toISOString(),
        };

        if (isWon && !client.soldAt) {
          updates.soldAt = new Date().toISOString().split('T')[0];
        }

        await updateDoc(doc(db, "clients", clientId), updates);

        // Trigger vehicle status pending validation if moved to "won"
        if (isWon && client.vehicleId) {`;

// replace ignores exact spacing
code = code.replace(/await updateDoc\(doc\(db, "clients", clientId\), \{\s*status: overColumnId,\s*updatedAt: new Date\(\)\.toISOString\(\),\s*\}\);\s*\/\/\s*Trigger vehicle status pending validation if moved to "won"\s*const overStr = String\(overColumnId \|\| ""\)\.toLowerCase\(\);\s*const isWon =\s*overColumnId === "won" \|\|\s*overStr\.includes\("ganado"\) \|\|\s*overStr\.includes\("vendido"\);\s*if \(isWon && client\.vehicleId\) \{/g, replacement.trim());

fs.writeFileSync('src/pages/Kanban.tsx', code);
