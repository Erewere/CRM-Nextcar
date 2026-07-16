import os

path = "src/components/MobileFab.tsx"
with open(path, "r") as f:
    content = f.read()

clients_query_old = """    let q = query(
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

clients_query_new = """    let q = query(
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

deals_query_old = """    let dq = query(
      collection(db, 'deals'),
      where('agencyId', '==', userData.agencyId)
    );
    if (userData.role === 'seller') {
      dq = query(
        collection(db, 'deals'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
    }"""

deals_query_new = """    let dq = query(
      collection(db, 'deals'),
      where('agencyId', '==', userData.agencyId)
    );
    if (userData.role === 'seller' || (userData.role === 'admin' && userData.adminMobileViewAllContacts === false)) {
      dq = query(
        collection(db, 'deals'),
        where('agencyId', '==', userData.agencyId),
        where('sellerId', '==', userData.id)
      );
    }"""

if clients_query_old in content:
    content = content.replace(clients_query_old, clients_query_new)
if deals_query_old in content:
    content = content.replace(deals_query_old, deals_query_new)

with open(path, "w") as f:
    f.write(content)
