"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { detectUserLocation, LOCATION_CHECK_INTERVAL_MS, type GeoLocation } from "@/lib/geo";

type GeoContextValue = {
  location: GeoLocation | null;
  isRestricted: boolean;
  isLoading: boolean;
  recheck: () => Promise<void>;
};

const GeoContext = createContext<GeoContextValue>({
  location: null,
  isRestricted: false,
  isLoading: true,
  recheck: async () => {},
});

export function GeoProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkLocation = useCallback(async () => {
    const result = await detectUserLocation();
    setLocation(result);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  useEffect(() => {
    intervalRef.current = setInterval(checkLocation, LOCATION_CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkLocation]);

  const isRestricted = location?.isRestricted ?? false;

  return (
    <GeoContext.Provider
      value={{
        location,
        isRestricted,
        isLoading,
        recheck: checkLocation,
      }}
    >
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  return useContext(GeoContext);
}
