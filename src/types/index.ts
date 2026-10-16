export interface LocationLog {
  id: string;
  user_id: string;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  created_at: string;
}

export interface PendingLocationUpdate {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  username: string;
}
