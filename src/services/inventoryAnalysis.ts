import { Vehicle } from "../types";

export const getAvailableVehicles = (vehicles: Vehicle[]) => {
    return vehicles.filter(v => v.status === "available" || !v.status);
};

export const calculateTotalInventoryValue = (vehicles: Vehicle[]) => {
    return vehicles.reduce((sum, v) => sum + (v.price || 0), 0);
};

export const calculateExpectedProfit = (vehicles: Vehicle[]) => {
    return vehicles.reduce((sum, v) => sum + ((v.price || 0) - (v.purchasePrice || 0)), 0);
};
