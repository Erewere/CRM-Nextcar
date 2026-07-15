#!/bin/bash
for file in src/pages/mobile/MobilePersons.tsx src/pages/Inventory.tsx src/pages/AgencyUsers.tsx src/pages/ClosedSales.tsx src/pages/Tasks.tsx src/components/ShareVehicleModal.tsx src/components/VehicleDetailModal.tsx; do
  # This is a bit complex for sed, let's just use perl
  perl -i -pe 'BEGIN{undef $/;} s/const uniqueClients.*?setClients\(uniqueClients\);/setClients(rawClients);/sg' $file
  perl -i -pe 'BEGIN{undef $/;} s/const uniqueClients.*?setClients\(uniqueClients\);/setClients(list);/sg' $file
done
