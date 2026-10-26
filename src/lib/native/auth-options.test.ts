import { describe, expect, it } from "vitest";
import { nativeAuthConfigFrom, socialButtonsFor } from "./auth-options";

const WEB = "123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com";
const IOS = "123456789012-zyxwvutsrqponmlkjihgfedcba543210.apps.googleusercontent.com";

describe("nativeAuthConfigFrom", () => {
  it("acepta solo client IDs de Google con forma válida", () => {
    expect(nativeAuthConfigFrom({ web: ` ${WEB} `, ios: IOS, apple: "1" })).toEqual({ googleWebClientId: WEB, googleIosClientId: IOS, apple: true });
    expect(nativeAuthConfigFrom({ web: "secreto-raro", ios: "", apple: "si" })).toEqual({ googleWebClientId: "", googleIosClientId: "", apple: false });
  });
});

describe("socialButtonsFor", () => {
  const full = nativeAuthConfigFrom({ web: WEB, ios: IOS, apple: "1" });
  const noApple = nativeAuthConfigFrom({ web: WEB, ios: IOS });
  const none = nativeAuthConfigFrom({});

  it("la web sigue igual que hoy (Google según NEXT_PUBLIC_GOOGLE_AUTH, sin Apple)", () => {
    expect(socialButtonsFor("web", full, true)).toEqual({ google: true, apple: false });
    expect(socialButtonsFor("web", full, false)).toEqual({ google: false, apple: false });
  });
  it("Android: Google nativo con el client ID web", () => {
    expect(socialButtonsFor("android", full, false)).toEqual({ google: true, apple: false });
    expect(socialButtonsFor("android", none, true)).toEqual({ google: false, apple: false });
  });
  it("iPhone: Google solo si Apple también está (regla 4.8)", () => {
    expect(socialButtonsFor("ios", full, false)).toEqual({ google: true, apple: true });
    expect(socialButtonsFor("ios", noApple, true)).toEqual({ google: false, apple: false });
    expect(socialButtonsFor("ios", nativeAuthConfigFrom({ web: WEB, apple: "1" }), true)).toEqual({ google: false, apple: true });
  });
});
