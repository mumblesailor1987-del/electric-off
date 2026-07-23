export type State = 'on' | 'off' | 'no_data' | 'contested';
export type Lang = 'ar' | 'en' | 'fr';
export type Tab = 'map' | 'replay' | 'stats' | 'estimate';

export interface Region {
  slug: string;
  governorate: string;
  delegation: string;
  name_ar: string;
  name_fr: string;
  name_en: string;
  lat: number;
  lng: number;
  famma_slug?: string;
}

export interface UserRegion {
  id: string;
  slug: string;
  name_ar: string;
  name_fr: string;
  name_en: string;
  governorate?: string;
  lat: number;
  lng: number;
  radius_m: number;
  verified: boolean;
  created_at: string;
  state: State;
  on_count: number;
  off_count: number;
}

export interface LiveZoneState {
  slug: string;
  governorate: string;
  delegation: string;
  name_ar: string;
  name_fr: string;
  name_en: string;
  lat: number;
  lng: number;
  on_count: number;
  off_count: number;
  state: State;
  last_update_ts: string | null;
  scraped_on: number;
  scraped_off: number;
  local_on: number;
  local_off: number;
  geometry_type?: 'polygon' | 'circle';
  radius_m?: number;
  verified?: boolean;
}

export interface Claim {
  id: number;
  region_slug: string;
  ts: string;
  value: 'on' | 'off';
  device_hash: string;
}

export interface Estimate {
  region_slug: string;
  target_ts: string;
  predicted_state: State;
  confidence: number;
  reasoning: string;
}

export interface HistorySnapshot {
  ts: string;
  on_count: number;
  off_count: number;
  state: State;
}
