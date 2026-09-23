export type UserRole = 'producer' | 'operator' | 'advisor';

export type PlotStatus = 'stale' | 'dry' | 'optimal' | 'wet';

export type ValveStatus = 'open' | 'closed';

export type CommandStatus = 'pending' | 'applied' | 'failed' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole;
  created_at: string;
  organization?: Organization;
}

export interface Plot {
  id: string;
  organization_id: string;
  name: string;
  crop: string | null;
  threshold_min: number;
  threshold_max: number;
  created_at: string;
}

export interface PlotWithStatus extends Plot {
  geojson: any;
  last_measured_at: string | null;
  last_moisture_pct: number | null;
  last_temp_c: number | null;
  last_rain_mm: number | null;
  status: PlotStatus;
}

export interface Station {
  id: string;
  plot_id: string;
  name: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface Reading {
  id: string;
  station_id: string;
  measured_at: string;
  moisture_pct: number;
  temp_c: number | null;
  rain_mm: number;
  source: 'sensor' | 'manual';
  created_at: string;
}

export interface Valve {
  id: string;
  plot_id: string;
  name: string;
  status: ValveStatus;
  updated_at: string;
}

export interface IrrigationCommand {
  id: string;
  valve_id: string;
  requested_by: string;
  action: 'open' | 'close';
  duration_min: number | null;
  status: CommandStatus;
  client_request_id: string;
  failure_reason: string | null;
  created_at: string;
  applied_at: string | null;
}
