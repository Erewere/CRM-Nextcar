const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
/match \/deals\/\{dealId\} \{[\s\S]*?allow update: if isSameAgency\(resource\.data\.agencyId\) &&\s*request\.resource\.data\.agencyId == resource\.data\.agencyId &&\s*\(isMaster\(\) \|\| isAdmin\(\) \|\| resource\.data\.sellerId == request\.auth\.uid\);/m,
`match /deals/{dealId} {
      function getClientVisibility(clientId) {
        return get(/databases/$(database)/documents/clients/$(clientId)).data.visibility;
      }
      allow read: if isSameAgency(resource.data.agencyId) && 
                  (isMaster() || isAdmin() || resource.data.sellerId == request.auth.uid || getClientVisibility(resource.data.clientId) == 'all');
                  
      allow create: if isSameAgency(request.resource.data.agencyId) && 
                    (isMaster() || isAdmin() || request.resource.data.sellerId == request.auth.uid);
                    
      allow update: if isSameAgency(resource.data.agencyId) &&
                    request.resource.data.agencyId == resource.data.agencyId &&
                    (isMaster() || isAdmin() || resource.data.sellerId == request.auth.uid || getClientVisibility(resource.data.clientId) == 'all');`
);

fs.writeFileSync('firestore.rules', content);
