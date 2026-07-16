import os

path = "src/pages/mobile/MobilePersons.tsx"
with open(path, "r") as f:
    content = f.read()

query_old = """      let q = query(
        collection(db, 'clients'),
        where('agencyId', '==', userData.agencyId)
      );
      
      if (userData.role === 'seller') {
        q = query(
          collection(db, 'clients'),
          where('agencyId', '==', userData.agencyId),
          where('sellerId', '==', userData.id)
        );
      }"""

query_new = """      let q = query(
        collection(db, 'clients'),
        where('agencyId', '==', userData.agencyId)
      );
      
      if (userData.role === 'seller' || (userData.role === 'admin' && userData.adminMobileViewAllContacts === false)) {
        q = query(
          collection(db, 'clients'),
          where('agencyId', '==', userData.agencyId),
          where('sellerId', '==', userData.id)
        );
      }"""

if query_old in content:
    content = content.replace(query_old, query_new)
else:
    print("Not found")

with open(path, "w") as f:
    f.write(content)
