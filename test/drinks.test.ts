// test/drinks.test.ts
import { describe, it, expect } from "vitest";
import { drinkToRow, drinkToApi } from "../src/drinks";

describe("drink mapping", () => {
  it("maps an api drink to a row with defaults", () => {
    const row = drinkToRow({ type: "Vin", category: "Rosé", name: "Whispering Angel", wineRegion: "Provence" }, "m1", 2);
    expect(row.match_id).toBe("m1");
    expect(row.drink_type).toBe("Vin");
    expect(row.drink_category).toBe("Rosé");
    expect(row.wine_region).toBe("Provence");
    expect(row.count).toBe(1);         // default
    expect(row.volume_cl).toBeNull();  // absent -> null
    expect(row.position).toBe(2);
    expect(typeof row.id).toBe("string");
  });

  it("carries count and volume through", () => {
    const row = drinkToRow({ type: "Øl", count: 3, volumeCl: 33 }, "m1", 0);
    expect(row.count).toBe(3);
    expect(row.volume_cl).toBe(33);
  });

  it("maps a row back to an api drink", () => {
    const d = drinkToApi({ drink_type: "Øl", drink_category: null, drink_brand: "Tuborg", drink_name: null, drink_country: "DK", wine_region: null, count: 2, volume_cl: 33 });
    expect(d).toEqual({ type: "Øl", category: null, brand: "Tuborg", name: null, country: "DK", wineRegion: null, count: 2, volumeCl: 33 });
  });
});
