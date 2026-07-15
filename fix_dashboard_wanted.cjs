const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const targetHelperStr = `const CustomTooltip = ({ active, payload, label }: any) => {`;
const helperStr = `const getWantedTitle = (c: Client) => {
  if (c.wantedVehicle && (c.wantedVehicle.make || c.wantedVehicle.model || (c.wantedVehicle.bodyType && c.wantedVehicle.bodyType !== 'Cualquiera'))) {
    return [c.wantedVehicle.make, c.wantedVehicle.model, c.wantedVehicle.bodyType !== 'Cualquiera' ? c.wantedVehicle.bodyType : ''].filter(Boolean).join(" ");
  }
  return c.vehicle || c.dealTitle || "Auto no especificado";
};

const CustomTooltip = ({ active, payload, label }: any) => {`;

content = content.replace(targetHelperStr, helperStr);

content = content.replaceAll(
  '{client.vehicle || client.dealTitle || "Auto no especificado"}',
  '{getWantedTitle(client)}'
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed Dashboard wanted vehicle display');
