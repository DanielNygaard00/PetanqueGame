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
};

export type Match = {
  id: string;
  Dato?: string;
  Gruppe_Bool?: boolean;
  Gruppe_medlemmer?: string;
  "Konsekutive spil"?: number;
  Spiller?: string;
  Arena?: string;
  Modstander?: string;
  Vundet?: boolean;
  Point?: number;
  Drik_Type?: string;
  Drik_Kategori?: string;
  Drik_Brand?: string;
  Drik_Land?: string;
  Drik_Navn?: string;
  Vin_Region?: string;
  "Spillets genstande"?: string;
  Tid?: string;
  Modstander_Point?: number;
  drinks?: Drink[];
};
