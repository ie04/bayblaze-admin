/// <reference types="google.maps" />

declare global {
  interface Window {
    google?: typeof google;
    __bayblazeGoogleMapsPromise?: Promise<typeof google.maps>;
  }
}

const mapsApiBaseUrl = "https://maps.googleapis.com/maps/api/js";

export function hasGoogleMapsBrowserKey() {
  return Boolean(readGoogleMapsBrowserKey());
}

export function loadGoogleMaps() {
  const apiKey = readGoogleMapsBrowserKey();

  if (!apiKey) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_BROWSER_API_KEY is not configured."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__bayblazeGoogleMapsPromise) {
    return window.__bayblazeGoogleMapsPromise;
  }

  window.__bayblazeGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const url = new URL(mapsApiBaseUrl);

    url.searchParams.set("key", apiKey);
    url.searchParams.set("v", "weekly");

    script.async = true;
    script.defer = true;
    script.src = url.toString();
    script.onerror = () => {
      window.__bayblazeGoogleMapsPromise = undefined;
      reject(new Error("Google Maps failed to load."));
    };
    script.onload = () => {
      if (!window.google?.maps) {
        reject(new Error("Google Maps loaded without a maps runtime."));
        return;
      }

      resolve(window.google.maps);
    };

    document.head.appendChild(script);
  });

  return window.__bayblazeGoogleMapsPromise;
}

function readGoogleMapsBrowserKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY?.trim() ?? "";
}
