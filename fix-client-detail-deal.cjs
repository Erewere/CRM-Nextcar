const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

content = content.replace(
    /if \('dealValue' in dataToUpdate\) \{\n\s*dealDataToUpdate\.value = dataToUpdate\.dealValue;\n\s*delete dataToUpdate\.dealValue;\n\s*\}/g,
    `if ('dealValue' in dataToUpdate) {
            dealDataToUpdate.value = dataToUpdate.dealValue ? Number(dataToUpdate.dealValue) : 0;
            delete dataToUpdate.dealValue;
          }
          if ('vehicleId' in dataToUpdate) {
            dealDataToUpdate.vehicleId = dataToUpdate.vehicleId;
            delete dataToUpdate.vehicleId;
          }
          if ('vehicle' in dataToUpdate) {
            dealDataToUpdate.vehicle = dataToUpdate.vehicle;
            delete dataToUpdate.vehicle;
          }`
);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
