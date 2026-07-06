export type AuthResponse = { token: string; user: { id: string; username: string } };
export type Player = { id: string; name: string; games: number };
export type Option = { id: string; name: string };
export type DrinkHierarchy = { types: Option[]; categories: Option[]; brands: Option[]; names: Option[] };

export type Drink = {
  type?: string | null;
  category?: string | null;
  brand?: string | null;
  name?: string | null;
  country?: string | null;
  wineRegion?: string | null;
  count?: number;
  volumeCl?: number | null;
  player?: string | null;
};

export type TeamPlayer = { id: string; name: string };
export type Team = { team: number; score: number | null; won: boolean; players: TeamPlayer[] };

export type Match = {
  id: string;
  Dato?: string;
  Tid?: string;
  Arena?: string;
  "Konsekutive spil"?: number;
  "Spillets genstande"?: string;
  teams?: Team[];
  drinks?: Drink[];
};
