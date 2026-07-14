const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
/allow update: if isSameAgency\(resource\.data\.agencyId\) &&\s*request\.resource\.data\.agencyId == resource\.data\.agencyId &&\s*allow delete:/,
`allow update: if isSameAgency(resource.data.agencyId) &&
                    request.resource.data.agencyId == resource.data.agencyId;
      allow delete:`
);

fs.writeFileSync('firestore.rules', content);
