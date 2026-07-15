const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!content.includes('const [agencyName, setAgencyName]')) {
  content = content.replace(
    'const [inactivityAlertDays, setInactivityAlertDays] = useState(14);',
    'const [inactivityAlertDays, setInactivityAlertDays] = useState(14);\n  const [agencyName, setAgencyName] = useState<string>("");'
  );
}

if (!content.includes('setAgencyName(data.name || "");')) {
  content = content.replace(
    'const data = docSnap.data();\n              if (',
    'const data = docSnap.data();\n              setAgencyName(data.name || "");\n              if ('
  );
}

content = content.replace(
  'userName={userData?.name || userData?.email || "Asesor"}\n          agencyId={userData?.agencyId || ""}',
  'userName={userData?.name || userData?.email || "Asesor"}\n          agencyId={userData?.agencyId || ""}\n          agencyName={agencyName}'
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Updated Dashboard");
