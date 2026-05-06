import { apiClient } from "@/lib/api";

export type MunicipalOffice = {
  _id: string;
  name: string;
  type: "main" | "sub";
  zone: string;
  workload: number;
  maxCapacity: number;
  isActive: boolean;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  mapLink?: string | null;
  googleMapsLink?: string | null;
  googleMapsDirectionsLink?: string | null;
};

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export const getMunicipalOffices = async (): Promise<MunicipalOffice[]> => {
  const response = await apiClient.get<Envelope<MunicipalOffice[]>>(
    "/municipal-offices",
    {
      params: {
        isActive: "true",
      },
    }
  );

  return response.data.data;
};
