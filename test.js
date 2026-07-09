const make = "Volkswagen";
const wvMake = "VW";
const make1 = make.toLowerCase().replace(/[^a-z0-9]/g, '');
const make2 = wvMake.toLowerCase().replace(/[^a-z0-9]/g, '');
console.log(make1, make2);
