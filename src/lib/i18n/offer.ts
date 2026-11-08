// La oferta del día (src/lib/offer.ts) en el idioma de la persona (#287). offer() sigue siendo la única fuente de las
// reglas por fecha; aquí solo se traduce cada texto. Las funciones se traducen con su plantilla: se llaman con un
// marcador ("{price}"), se busca esa frase en el diccionario y se rellena.
import { offer, type Offer } from "@/lib/offer";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { translate } from "./t";

export function offerFor(locale: Locale, now = new Date()): Offer {
  const o = offer(now);
  if (locale === DEFAULT_LOCALE) return o;
  const t = (s: string) => translate(locale, s);
  const tpl = <A,>(fn: (a: A) => string, mark: string) => (a: A) => translate(locale, fn(`{${mark}}` as A), { [mark]: String(a) });
  return {
    ...o,
    note: t(o.note), faqCtaExtra: o.faqCtaExtra ? ` ${t(o.faqCtaExtra.trim())}` : "", seo: t(o.seo), riskLine: t(o.riskLine), statLabel: t(o.statLabel),
    pricingTrial: t(o.pricingTrial), faqCancel: t(o.faqCancel), signupLine: t(o.signupLine), ogLine: t(o.ogLine), llms: t(o.llms),
    guarantee: [t(o.guarantee[0]), t(o.guarantee[1])], signupChecks: [t(o.signupChecks[0]), t(o.signupChecks[1])],
    from: tpl(o.from, "price"), pricingIntro: tpl<number>(o.pricingIntro, "pct"), faqTrial: tpl(o.faqTrial, "plan"),
  };
}
