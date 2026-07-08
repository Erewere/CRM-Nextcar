const fs = require('fs');
const content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

const funcs = `
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== "string" && !(bstr instanceof ArrayBuffer)) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const columns = Object.keys(data[0] as object);
        setExcelColumns(columns);
        setExcelData(data);
        setShowImportExcel(true);
        // Autoselect if column names match somewhat
        const newMapping = { 
            make: "", model: "", year: "", price: "", purchasePrice: "",
            vin: "", color: "", transmission: "", bodyType: "", km: ""
        };
        columns.forEach((col) => {
          const lcol = col.toLowerCase();
          if (lcol.includes("marca") || lcol.includes("make")) newMapping.make = col;
          if (lcol.includes("modelo") || lcol.includes("model")) newMapping.model = col;
          if (lcol.includes("año") || lcol.includes("year") || lcol.includes("ano")) newMapping.year = col;
          if (lcol.includes("precio") || lcol.includes("price") || lcol.includes("venta")) newMapping.price = col;
          if (lcol.includes("costo") || lcol.includes("compra") || lcol.includes("purchase")) newMapping.purchasePrice = col;
          if (lcol.includes("vin") || lcol.includes("serie")) newMapping.vin = col;
          if (lcol.includes("color")) newMapping.color = col;
          if (lcol.includes("transmision") || lcol.includes("transmisión")) newMapping.transmission = col;
          if (lcol.includes("carroceria") || lcol.includes("carrocería") || lcol.includes("tipo")) newMapping.bodyType = col;
          if (lcol.includes("km") || lcol.includes("kilometraje")) newMapping.km = col;
        });
        setColumnMapping(newMapping);
      } else {
        alert("El archivo parece estar vacío.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleImportExcelData = async () => {
    if (!columnMapping.make || !columnMapping.model) {
      alert("Debes seleccionar al menos la columna para Marca y Modelo.");
      return;
    }
    
    setImportingVehicles(true);
    let importedCount = 0;
    
    try {
      for (const row of excelData) {
        const vMake = row[columnMapping.make] ? String(row[columnMapping.make]) : "";
        const vModel = row[columnMapping.model] ? String(row[columnMapping.model]) : "";
        const vYearStr = columnMapping.year && row[columnMapping.year] ? String(row[columnMapping.year]) : "";
        const vYear = parseInt(vYearStr) || new Date().getFullYear();
        const vPriceStr = columnMapping.price && row[columnMapping.price] ? String(row[columnMapping.price]).replace(/[^0-9.-]+/g,"") : "0";
        const vPrice = parseFloat(vPriceStr) || 0;
        const vCostStr = columnMapping.purchasePrice && row[columnMapping.purchasePrice] ? String(row[columnMapping.purchasePrice]).replace(/[^0-9.-]+/g,"") : "0";
        const vCost = parseFloat(vCostStr) || 0;
        const vVin = columnMapping.vin && row[columnMapping.vin] ? String(row[columnMapping.vin]) : "";
        const vColor = columnMapping.color && row[columnMapping.color] ? String(row[columnMapping.color]) : "";
        const vTransmission = columnMapping.transmission && row[columnMapping.transmission] ? String(row[columnMapping.transmission]) : "Automática";
        const vBodyType = columnMapping.bodyType && row[columnMapping.bodyType] ? String(row[columnMapping.bodyType]) : "Sedán";
        const vKmStr = columnMapping.km && row[columnMapping.km] ? String(row[columnMapping.km]).replace(/[^0-9.-]+/g,"") : "0";
        const vKm = parseInt(vKmStr) || 0;

        if (vMake && vModel) {
          const newRef = doc(collection(db, "vehicles"));
          const newVehicle: any = {
            id: newRef.id,
            agencyId: userData?.agencyId || "",
            make: vMake,
            model: vModel,
            year: vYear,
            price: vPrice,
            purchasePrice: vCost,
            vin: vVin,
            color: vColor,
            transmission: vTransmission,
            bodyType: vBodyType,
            km: vKm,
            status: "available",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(doc(db, "vehicles", newRef.id), newVehicle);
          importedCount++;
        }
      }

      alert(\`Se importaron \${importedCount} vehículos nuevos desde Excel.\`);
      setShowImportExcel(false);
      setExcelData([]);
    } catch (e) {
      console.error("Error al importar vehículos:", e);
      alert("Hubo un error al importar los vehículos.");
    } finally {
      setImportingVehicles(false);
    }
  };
`;

const lines = content.split('\\n');
const insertIndex = lines.findIndex(l => l.includes('const [sortConfig, setSortConfig] = useState'));

lines.splice(insertIndex, 0, funcs);

fs.writeFileSync('src/pages/Inventory.tsx', lines.join('\\n'));
