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
