import os

path = "src/pages/VehiclePrint.tsx"
with open(path, "r") as f:
    content = f.read()

old_useEffect = """  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'vehicles', id)).then(snap => {
      if (snap.exists()) {
        setVehicle({ ...snap.data(), id: snap.id } as Vehicle);
        setTimeout(() => {
          window.print();
        }, 500);
      }
    });
  }, [id]);"""

new_useEffect = """  const [imgLoaded, setImgLoaded] = useState(false);
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'vehicles', id)).then(snap => {
      if (snap.exists()) {
        const v = { ...snap.data(), id: snap.id } as Vehicle;
        setVehicle(v);
        if (!v.photoUrls?.[0] && !v.photoUrl) {
           setImgLoaded(true);
        }
      }
    });
  }, [id]);

  useEffect(() => {
    if (vehicle && imgLoaded && !printTriggered) {
      setPrintTriggered(true);
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [vehicle, imgLoaded, printTriggered]);"""

content = content.replace(old_useEffect, new_useEffect)

old_img = """            <img 
              src={vehicle.photoUrls?.[0] || vehicle.photoUrl} 
              alt={`${vehicle.make} ${vehicle.model}`} 
              className="max-h-[300px] print:max-h-[220px] w-auto object-cover rounded-2xl shadow-xl border-4 border-slate-200"
            />"""

new_img = """            <img 
              src={vehicle.photoUrls?.[0] || vehicle.photoUrl} 
              alt={`${vehicle.make} ${vehicle.model}`} 
              className="max-h-[300px] print:max-h-[220px] w-auto object-cover rounded-2xl shadow-xl border-4 border-slate-200"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
              crossOrigin="anonymous"
            />"""

content = content.replace(old_img, new_img)

with open(path, "w") as f:
    f.write(content)
