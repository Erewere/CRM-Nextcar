const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /const dataToUpdate = \{ \.\.\.formData, updatedAt: new Date\(\)\.toISOString\(\) \};/g,
    `const dataToUpdate = { ...formData, updatedAt: new Date().toISOString() };\n                        if (dataToUpdate.dealValue !== undefined) {\n                          dataToUpdate.dealValue = dataToUpdate.dealValue ? Number(dataToUpdate.dealValue) : 0;\n                        }`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
