import { describe, expect, it } from "vitest";
import { nativeAgentFrom, platformFromUserAgent } from "./platform-ua";

const UA = {
  iosApp: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BananaBurnApp/1 (ios)",
  androidApp: "Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A.241005.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 BananaBurnApp/3 (android)",
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
};

describe("nativeAgentFrom", () => {
  it("app de iPhone", () => expect(nativeAgentFrom(UA.iosApp)).toEqual({ platform: "ios", shell: 1 }));
  it("app de Android, con el número de cascarón", () => expect(nativeAgentFrom(UA.androidApp)).toEqual({ platform: "android", shell: 3 }));
  it("navegadores normales no son la app", () => {
    expect(nativeAgentFrom(UA.iosSafari)).toBeNull();
    expect(nativeAgentFrom(UA.androidChrome)).toBeNull();
  });
  it("sin user agent o con uno raro", () => {
    expect(nativeAgentFrom(null)).toBeNull();
    expect(nativeAgentFrom("")).toBeNull();
    expect(nativeAgentFrom("BananaBurnApp/x (ios)")).toBeNull();
    expect(nativeAgentFrom("BananaBurnApp/1 (windows)")).toBeNull();
    expect(nativeAgentFrom("NotBananaBurnApp/1 (ios)")).toBeNull();
  });
});

describe("platformFromUserAgent", () => {
  it("ios, android o web", () => {
    expect(platformFromUserAgent(UA.iosApp)).toBe("ios");
    expect(platformFromUserAgent(UA.androidApp)).toBe("android");
    expect(platformFromUserAgent(UA.iosSafari)).toBe("web");
    expect(platformFromUserAgent(undefined)).toBe("web");
  });
});
