const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /let finalFormData = \{ \.\.\.formData \};/g,
    `let finalFormData = { ...formData };\n    if (finalFormData.dealValue !== undefined) {\n      finalFormData.dealValue = finalFormData.dealValue ? Number(finalFormData.dealValue) : 0;\n    }`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
