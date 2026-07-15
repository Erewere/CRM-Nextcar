const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
  `  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "files" | "deals">("activity");`,
  `  const [activeTab, setActiveTab] = useState<"activity" | "notes" | "files" | "deals">("activity");
  const [businessHours, setBusinessHours] = useState({ start: 8, end: 20 });`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
console.log('Fixed ClientDetailModal.tsx');
