import { describe, expect, it } from "vitest";
import { canSuggestInstall, detectInstallEnv, installCardDue, INSTALL_CARD_SNOOZE_MS, pushMomentReady, pushNeedsInstall } from "./install-env";

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; es_LA; es; scale=3.00; 1170x2532; 612245432)",
  iosFacebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.43.109;FBBV/612345;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/es_LA;FBOP/5]",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;]",
  androidInstagram: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240605.024; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 334.0.0.42.95 Android",
  desktopChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

describe("detectInstallEnv", () => {
  it("iPhone en Safari", () => expect(detectInstallEnv(UA.iosSafari)).toBe("ios-safari"));
  it("iPhone dentro de Instagram", () => expect(detectInstallEnv(UA.iosInstagram)).toBe("ios-inapp"));
  it("iPhone dentro de Facebook", () => expect(detectInstallEnv(UA.iosFacebook)).toBe("ios-inapp"));
  it("iPhone en Chrome", () => expect(detectInstallEnv(UA.iosChrome)).toBe("ios-browser"));
  it("iPad que se presenta como Mac (pantalla táctil)", () => expect(detectInstallEnv(UA.ipadOs, { maxTouchPoints: 5 })).toBe("ios-safari"));
  it("Mac de verdad: computadora", () => expect(detectInstallEnv(UA.macSafari, { maxTouchPoints: 0 })).toBe("desktop"));
  it("Android en Chrome", () => expect(detectInstallEnv(UA.androidChrome)).toBe("android"));
  it("Android dentro de Facebook", () => expect(detectInstallEnv(UA.androidFacebook)).toBe("android-inapp"));
  it("Android dentro de Instagram", () => expect(detectInstallEnv(UA.androidInstagram)).toBe("android-inapp"));
  it("computadora con Chrome", () => expect(detectInstallEnv(UA.desktopChrome)).toBe("desktop"));
  it("ya instalada gana sobre todo", () => {
    expect(detectInstallEnv(UA.iosSafari, { standalone: true })).toBe("standalone");
    expect(canSuggestInstall("standalone")).toBe(false);
  });
});

describe("avisos y tarjeta de instalar", () => {
  it("iPhone sin instalar no recibe avisos", () => {
    expect(pushNeedsInstall("ios-safari")).toBe(true);
    expect(pushNeedsInstall("android")).toBe(false);
    expect(pushNeedsInstall("standalone")).toBe(false);
  });
  it("se piden después del primer entreno o desde la segunda visita", () => {
    expect(pushMomentReady("standalone", { opens: 1, trained: false })).toBe(false);
    expect(pushMomentReady("standalone", { opens: 2, trained: false })).toBe(true);
    expect(pushMomentReady("standalone", { opens: 1, trained: true })).toBe(true);
    expect(pushMomentReady("ios-safari", { opens: 5, trained: true })).toBe(false);
    expect(pushMomentReady("android-inapp", { opens: 5, trained: true })).toBe(false);
    expect(pushMomentReady("android", { opens: 3, trained: false })).toBe(true);
  });
  it("la tarjeta vuelve como máximo cada 3 días", () => {
    const now = Date.UTC(2026, 10, 10);
    expect(installCardDue(null, now)).toBe(true);
    expect(installCardDue(now - INSTALL_CARD_SNOOZE_MS + 1000, now)).toBe(false);
    expect(installCardDue(now - INSTALL_CARD_SNOOZE_MS, now)).toBe(true);
  });
});

describe("app nativa (tiendas)", () => {
  const iosApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BananaBurnApp/1 (ios)";
  const androidApp = "Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A.241005.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 BananaBurnApp/1 (android)";
  it("cuenta como instalada: sin tarjeta de instalar ni 'ábrela en Safari o Chrome'", () => {
    expect(detectInstallEnv(iosApp)).toBe("standalone");
    expect(detectInstallEnv(androidApp)).toBe("standalone");
    expect(canSuggestInstall(detectInstallEnv(androidApp))).toBe(false);
    expect(pushNeedsInstall(detectInstallEnv(iosApp))).toBe(false);
  });
});
