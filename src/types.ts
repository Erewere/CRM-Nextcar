export interface User {
  id: string; // The uid created in Firebase Auth
  email: string;
  role: "master" | "admin" | "seller" | "unassigned";
  agencyId: string;
  name: string;
  createdAt: string | Date;
}

export interface PipelineStage {
  id: string;
  title: string;
}

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  description: string;
  amount: number;
  date: string;
  addedBy: string;
}

export interface Vehicle {
  id: string;
  agencyId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  transmission: string;
  bodyType: string;
  photoUrl: string;
  price: number;
  purchasePrice: number;
  vin: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // New fields
  km?: number;
  receivedAt?: string;
  cylinders?: number;
  liters?: number;
  equipment?: string;
  passengers?: number;
}

export interface Agency {
  id: string;
  name: string;
  phoneWhatsApp?: string;
  pipelineStages?: PipelineStage[];
  createdAt: string | Date;
}

export interface Deal {
  id: string;
  agencyId: string;
  clientId: string;
  title: string;
  value?: number;
  status: "open" | "won" | "lost";
  stageId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Client {
  id: string;
  agencyId: string;
  sellerId: string;
  visibility?: "private" | "all";
  name: string;
  dealTitle?: string;
  dealValue?: number;
  organization?: string;
  address: string;
  phone: string;
  street?: string;
  exteriorNumber?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
  email: string;
  vehicle: string;
  vehicleId?: string;
  status: string;
  origin: "manual" | "whatsapp" | "web" | "google_contacts";
  tags?: string[];
  wantedVehicle?: {
    make?: string;
    model?: string;
    yearMin?: number;
    yearMax?: number;
    priceMax?: number;
    passengers?: number;
    bodyType?: string;
  };
  createdAt: any;
  updatedAt: any;
}

export interface Task {
  id: string;
  agencyId: string;
  sellerId: string;
  clientId?: string;
  dealId?: string;
  title: string;
  type?: string;
  notes?: string;
  dueDate: string;
  startTime?: string;
  endTime?: string;
  completed: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface ClientFile {
  id: string;
  agencyId: string;
  clientId: string;
  userId?: string;
  filename: string;
  url: string;
  uploadedAt: any;
}
