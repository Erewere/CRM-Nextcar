const fs = require('fs');
let code = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const replacement = `
    let differences = 0;

    const normalize = (str?: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const checkMatch = (v?: string, w?: string) => {
        const nv = normalize(v);
        const nw = normalize(w);
        if (!nw) return true;
        if (nv.includes(nw) || nw.includes(nv)) return true;
        
        // Aliases make
        if ((nv === 'vw' || nv === 'volkswagen') && (nw === 'vw' || nw === 'volkswagen')) return true;
        if ((nv === 'chevy' || nv === 'chevrolet') && (nw === 'chevy' || nw === 'chevrolet')) return true;
        
        return false;
    };

    // Make & Model
    const makeMatches = wv.make ? checkMatch(vehicle.make, wv.make) : true;
    const modelMatches = wv.model ? checkMatch(vehicle.model, wv.model) : true;
`;

code = code.replace(/    let differences = 0;\s*\/\/\s*Make & Model\s*const makeMatches = wv\.make \? vehicle\.make\.toLowerCase\(\)\.includes\(wv\.make\.toLowerCase\(\)\) : true;\s*const modelMatches = wv\.model \? vehicle\.model\.toLowerCase\(\)\.includes\(wv\.model\.toLowerCase\(\)\) : true;/, replacement);

fs.writeFileSync('src/pages/Inventory.tsx', code);
