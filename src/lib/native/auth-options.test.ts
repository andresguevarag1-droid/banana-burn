import { describe, expect, it } from "vitest";
import { nativeAuthConfigFrom, socialButtonsFor } from "./auth-options";
import { detectInstallEnv, inAppOpenIn } from "@/lib/install-env";

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

describe("Google dentro de Instagram o Facebook (#235)", () => {
  const cfg = nativeAuthConfigFrom({ web: WEB, ios: IOS, apple: "1" });
  const UA = {
    igIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 335.0.3.20.79 (iPhone14,5; iOS 17_5; es_LA; es; scale=3.00; 1170x2532; 610511232)",
    fbIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/612345678;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/es_LA;FBOP/5]",
    igAndroid: "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.38.100 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546E; a54x; s5e8835; es_US; 650123456)",
    fbAndroid: "Mozilla/5.0 (Linux; Android 13; moto g54 5G Build/T1TDS33.75-28-4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.70.77;]",
    safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    chrome: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36",
  };
  const buttons = (ua: string) => socialButtonsFor("web", cfg, true, inAppOpenIn(detectInstallEnv(ua)) !== null);

  it("sin botón de Google en Instagram y Facebook, iPhone y Android", () => {
    expect(inAppOpenIn(detectInstallEnv(UA.igIos))).toBe("Safari");
    expect(inAppOpenIn(detectInstallEnv(UA.fbIos))).toBe("Safari");
    expect(inAppOpenIn(detectInstallEnv(UA.igAndroid))).toBe("Chrome");
    expect(inAppOpenIn(detectInstallEnv(UA.fbAndroid))).toBe("Chrome");
    for (const ua of [UA.igIos, UA.fbIos, UA.igAndroid, UA.fbAndroid]) expect(buttons(ua)).toEqual({ google: false, apple: false });
  });
  it("con botón de Google en Safari y Chrome", () => {
    for (const ua of [UA.safari, UA.chrome]) {
      expect(inAppOpenIn(detectInstallEnv(ua))).toBeNull();
      expect(buttons(ua)).toEqual({ google: true, apple: false });
    }
  });
});
