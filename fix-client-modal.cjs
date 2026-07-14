const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

// Add isDealContext
if (!content.includes('const isDealContext')) {
  content = content.replace(
    /const hasBuscaAutoTag = [\s\S]*?;/,
    `$&
  const isDealContext = client.originalClientId !== undefined || isNew;`
  );
}

// Replace formData.dealTitle || isNew with isDealContext
content = content.replace(
  /name=\{formData\.dealTitle \|\| isNew \? "dealTitle" : "name"\}/g,
  `name={isDealContext ? "dealTitle" : "name"}`
);

content = content.replace(
  /if \(formData\.dealTitle \|\| isNew\) \{/g,
  `if (isDealContext) {`
);

content = content.replace(
  /\{\(formData\.dealTitle \|\| isNew\) && \(/g,
  `{isDealContext && (`
);

content = content.replace(
  /placeholder=\{isNew \? "Nuevo Trato" : "Nombre"\}/g,
  `placeholder={isDealContext ? "Nuevo Trato" : "Nombre"}`
);

content = content.replace(
  /value=\{formData\.dealTitle \|\| formData\.name \|\| ""\}/g,
  `value={isDealContext ? (formData.dealTitle || "") : (formData.name || "")}`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
