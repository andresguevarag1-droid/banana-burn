export type DeviceId = "apple" | "android" | "garmin" | "fitbit" | "strava" | "whoop_oura";
export const DEVICES: { id: DeviceId; n: string; what: string }[] = [
  { id: "apple", n: "Apple Watch y Salud de iPhone", what: "Pasos, ritmo cardíaco y calorías" },
  { id: "android", n: "Relojes Android (Samsung, Pixel y otros)", what: "Pasos, ritmo cardíaco y sueño" },
  { id: "garmin", n: "Garmin", what: "Pasos, entrenos y recuperación" },
  { id: "fitbit", n: "Fitbit", what: "Pasos, ritmo cardíaco y sueño" },
  { id: "strava", n: "Strava", what: "Caminatas, carreras y bici" },
  { id: "whoop_oura", n: "Whoop u Oura", what: "Sueño y recuperación" },
];
