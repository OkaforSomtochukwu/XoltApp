import * as Location from "expo-location";
import { LOCATION_TIMEOUT_MS } from "./constants";

export class LocationPermissionDeniedError extends Error {
  constructor() {
    super("Location permission was denied.");
    this.name = "LocationPermissionDeniedError";
  }
}

export class LocationTimeoutError extends Error {
  constructor() {
    super(`Location request timed out after ${LOCATION_TIMEOUT_MS}ms.`);
    this.name = "LocationTimeoutError";
  }
}

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

/**
 * Wraps expo-location's getCurrentPositionAsync with a hard timeout so a
 * slow/stuck GPS fix can never hang the caller silently — every earlier
 * "the app is slow" complaint traced back to exactly this. Throws
 * `LocationPermissionDeniedError` or `LocationTimeoutError` instead of
 * resolving indefinitely or swallowing the failure.
 */
export async function getCurrentLocation(): Promise<CurrentLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new LocationPermissionDeniedError();
  }

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new LocationTimeoutError()), LOCATION_TIMEOUT_MS);
  });

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } finally {
    clearTimeout(timeoutId!);
  }
}
