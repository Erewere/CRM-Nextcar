const fs = require('fs');
let code = fs.readFileSync('src/pages/Billing.tsx', 'utf8');

code = code.replace(
  /if \(url\) window.location.href = url;/g,
  `if (url) {
        if (window !== window.top) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }`
);

fs.writeFileSync('src/pages/Billing.tsx', code);
