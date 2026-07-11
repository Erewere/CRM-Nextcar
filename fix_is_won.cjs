const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regexToExtractAndRemove = /  \/\/ Contacts\n\s*const isWon = \(status: string = ""\) => \{[\s\S]*?const isActive = \(status: string\) => !isWon\(status\) && !isLost\(status\);\n/g;

// Instead of regex for extraction, I'll just write the replacement.
code = code.replace(regexToExtractAndRemove, '  // Contacts\n');

const helpers = `
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
  const lostKeywords = ["perdid", "lost"];
  const isLost = (status: string = "") =>
    lostKeywords.some((k) =>
      String(status || "")
        .toLowerCase()
        .includes(k),
    );
  const isActive = (status: string) => !isWon(status) && !isLost(status);
`;

code = code.replace(
  '  // --- Process Data With Filters ---',
  '  // --- Process Data With Filters ---\n' + helpers
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
