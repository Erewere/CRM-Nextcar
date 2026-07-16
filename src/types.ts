export interface User {
  id: string; // The uid created in Firebase Auth
  email: string;
  role: "master" | "admin" | "seller" | "unassigned";
  agencyId: string;
  name: string;
  createdAt: string | Date;
  photoURL?: string;
  adminMobileViewAllContacts?: boolean;
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
  photoUrls?: string[];
  price: number;
  purchasePrice: number;
  vin: string;
  websiteUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // New fields
  ownership?: 'propio' | 'consignacion' | string;
  km?: number;
  receivedAt?: string;
  cylinders?: number;
  liters?: number;
  equipment?: string;
  passengers?: number;
  soldAt?: string;
  saleDetails?: SaleDetails;
}

export interface Agency {
  id: string;
  name: string;
  phoneWhatsApp?: string;
  pipelineStages?: PipelineStage[];
  businessHours?: { start: string; end: string };
  createdAt: string | Date;
}

export interface Deal {
  id: string;
  agencyId: string;
  clientId: string;
  sellerId?: string;
  title: string;
  value?: number;
  status: string; // The pipeline stage ID or 'won' / 'lost'
  vehicleId?: string;
  vehicle?: string;
  origin?: string;
  createdAt: any;
  updatedAt: any;
}



export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro';
  notes?: string;
}

export interface SaleDetails {
  method: 'contado' | 'credito' | 'credito_bancario';
  price: number;
  downPayment?: number;
  termMonths?: number;
  interestRate?: number;
  interestType?: 'mensual' | 'anual';
  calculatedTotalInterest?: number;
  calculatedTotalAmount?: number;
  calculatedMonthlyPayment?: number;
  firstPaymentDate?: string;
  payments?: PaymentRecord[];
}

export interface Client {
  id: string;
  originalClientId?: string;
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
  soldAt?: string;
  saleDetails?: SaleDetails;
  origin: "manual" | "whatsapp" | "web" | "website" | "google_contacts" | "excel_import" | "facebook" | "instagram";
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
  googleEventId?: string;
  googleTaskId?: string;
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
