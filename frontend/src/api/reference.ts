import api from "./client";

export interface ReferenceCountry {
  id: string;
  iso2_code: string;
  iso3_code: string | null;
  country_name: string;
  phone_code: string | null;
  currency_code: string | null;
  nationality: string | null;
  continent: string | null;
}

export interface ReferenceStateProvince {
  id: string;
  state_code: string | null;
  state_name: string;
  type: string | null;
}

export interface ReferenceCity {
  id: string;
  city_name: string;
  country_id: string;
}

export const referenceApi = {
  countries(): Promise<ReferenceCountry[]> {
    return api.get<ReferenceCountry[]>("/reference/countries").then((r) => r.data);
  },

  states(countryId: string): Promise<ReferenceStateProvince[]> {
    return api
      .get<ReferenceStateProvince[]>(`/reference/countries/${countryId}/states`)
      .then((r) => r.data);
  },

  cities(stateId: string): Promise<ReferenceCity[]> {
    return api
      .get<ReferenceCity[]>(`/reference/states/${stateId}/cities`)
      .then((r) => r.data);
  },

  searchCities(q: string, countryId?: string): Promise<ReferenceCity[]> {
    return api
      .get<ReferenceCity[]>("/reference/cities/search", {
        params: { q, ...(countryId ? { country_id: countryId } : {}) },
      })
      .then((r) => r.data);
  },
};
