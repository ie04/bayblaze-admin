export type AccountRole = "admin" | "driver" | "inventory";
export type AccountBadge = "customer" | "employee";

export type Account = {
  disabled: boolean;
  displayName: string;
  email: string;
  badges: AccountBadge[];
  roles: AccountRole[];
  settings: {
    ageVerificationDisabled: boolean;
  };
  uid: string;
  winReferrals?: AccountWinReferral[];
};

export type AccountWinReferral = {
  campaign: string;
  claimTokenIssued: boolean;
  claimedAt: string;
  claimedProductId: string;
  claimedVariantId: string;
  completedOrderId: string;
  createdAt: string;
  freebieConsumed: boolean;
  id: string;
  qualifiedAt: string;
  referralCode: string;
  referralConsumed: boolean;
  referralUrl: string;
  status: string;
  updatedAt: string;
};

export type Session = {
  account: Account;
  token: string;
};

export type LatLng = {
  lat: number;
  lng: number;
};

export type DriverMapEntry = {
  activeVehicle: { label?: string; vehicleId?: string; plateNumber?: string } | null;
  clockedIn: boolean;
  displayName: string;
  email: string;
  location: (LatLng & { accuracy?: number; clientCapturedAt?: number; updatedAt?: unknown }) | null;
  onboardingComplete: boolean;
  queue: { activeOrderId: string | null; stopCount: number; updatedAt?: unknown } | null;
  uid: string;
};

export type DriverRoute = {
  activeOrderId: string | null;
  stops: Array<{
    customerAddress: string;
    customerName: string;
    index: number;
    locked: boolean;
    orderId: string;
    orderReference: string;
    position: LatLng | null;
    score: number | null;
    status: string;
  }>;
  uid: string;
  updatedAt?: unknown;
};

export type IsochronePlot = {
  center: LatLng & { address?: string };
  method: string;
  polygon: LatLng[];
  radiusMeters: number;
  travelMinutes: number;
};

export type CoverageArea = {
  active: boolean;
  algorithmVersion: string;
  createdAt: string;
  description: string;
  granularity: {
    binarySearchIterations: number;
    sampleBearings: number;
  };
  id: string;
  label: string;
  lastGeneratedAt: string;
  lastGenerationError: string;
  maxDriveTimeMinutes: number;
  polygon: LatLng[];
  radiusMeters: number;
  schedule: {
    enabled: boolean;
    intervalHours: number | null;
    nextRunAt: string | null;
  };
  updatedAt: string;
  warehouse: {
    address: string;
    label: string;
    location: LatLng;
    warehouseId: string;
  };
};

export type CoverageAreaInput = {
  active?: boolean;
  description?: string;
  granularity?: {
    binarySearchIterations?: number;
    sampleBearings?: number;
  };
  label?: string;
  maxDriveTimeMinutes?: number;
  regenerate?: boolean;
  schedule?: {
    enabled?: boolean;
    intervalHours?: number | null;
    nextRunAt?: string | null;
  };
  warehouse?: {
    address?: string;
    label?: string;
    lat?: number;
    lng?: number;
    warehouseId?: string;
  };
};

export type AdminPromoCodeType = "discount" | "bogo";
export type AdminPromoCodeCategory = "admin_promo" | "win_referral";

export type AdminPromoCode = {
  campaign?: string;
  category: AdminPromoCodeCategory;
  code: string;
  codeType: AdminPromoCodeType;
  discountPercent: number;
  minimumSpendCents: number;
  ownerUid?: string;
  referralCode?: string;
  rewardId?: string;
  singleUsePerAccount: boolean;
  status: string;
  usageLimit: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EmailRecipientMode = "customer" | "internal" | "both";

export type EmailAutomation = {
  description: string;
  enabled: boolean;
  eventType: "order_placed";
  fromEmail: string;
  htmlTemplate: string;
  internalRecipientEmails: string[];
  label: string;
  recipientMode: EmailRecipientMode;
  replyTo: string;
  subjectTemplate: string;
  textTemplate: string;
  updatedAt: string;
};

export type EmailAutomationLog = {
  createdAt: string;
  eventId: string;
  eventType: string;
  id: string;
  message: string;
  recipientCount: number;
  status: string;
  subject: string;
  to: string[];
};

export type MedusaOrder = Record<string, unknown> & {
  id?: string;
  display_id?: number;
  email?: string;
  orderReference?: string;
  created_at?: string;
  total?: number;
  currency_code?: string;
  fulfillment_status?: string;
  payment_status?: string;
  metadata?: Record<string, unknown>;
};
