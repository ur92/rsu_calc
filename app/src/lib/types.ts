export interface VestEvent {
  vestDate: Date;
  qty: number;
  fmvAtVest?: number;
}

export interface RsuGrant {
  grantNumber: string;
  grantDate: Date;
  fmvAtGrant: number;
  grantedQty: number;
  vestedQty: number;
  unvestedQty: number;
  blockedQty: number;
  vestSchedule: VestEvent[];
}

export interface OptionGrant {
  grantNumber: string;
  grantDate: Date;
  exercisePrice: number;
  grantedQty: number;
  exercisableQty: number;
  blockedQty: number;
  expirationDate?: Date;
  vestSchedule: VestEvent[];
}

export interface EsppPurchase {
  purchaseDate: Date;
  grantDate: Date;
  purchasePrice: number;
  grantDateFmv: number;
  purchaseDateFmv: number;
  purchasedQty: number;
  blockedQty: number;
  discountPct: number;
}

export interface ParsedData {
  rsus: RsuGrant[];
  options: OptionGrant[];
  espp: EsppPurchase[];
}
