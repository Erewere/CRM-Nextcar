const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /\/\/ Update vehicleId on the deal\n\s*if \('vehicleId' in dataToUpdate\) \{\n\s*dealDataToUpdate\.vehicleId = dataToUpdate\.vehicleId;\n\s*delete dataToUpdate\.vehicleId;\n\s*\}/g,
    ''
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
