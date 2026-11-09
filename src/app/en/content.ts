// Portada en inglés (#287): textos escritos para Estados Unidos, no traducidos frase a frase de la portada en español.
// Lo que depende de la fecha (beta, prueba sin tarjeta, tarjeta al registrarse) sale de offerFor("en-US").
import { PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { fmtMoney } from "@/lib/i18n/format";
import { offerFor } from "@/lib/i18n/offer";

const ENTRENO = PLANS.find((p) => p.id === "entreno")!;

/** Registro desde la portada en inglés: ?idioma=en deja el idioma en la cookie en el middleware. */
export const SIGNUP_EN = "/entrar?modo=registro&idioma=en";
export const SIGNIN_EN = "/entrar?idioma=en";
export const FROM_EN = fmtMoney(ENTRENO.price.mes, "en-US");
export const CTA_EN = `Start your ${TRIAL_DAYS}-day free trial`;

export const NAV_EN = [
  ["/en#how-it-works", "How it works"],
  ["/en#pricing", "Pricing"],
  ["/en#faq", "FAQ"],
] as const;

export const homeFaqEn = (): [string, string][] => {
  const o = offerFor("en-US");
  return [
    ["Do I need to know how to work out?", "No. Every exercise comes with an animated demo and simple cues from Coach Banana. Your first workout is short and teaches you the basic moves at your own pace."],
    ["How does the free trial work?", o.faqTrial("Training + Nutrition")],
    ["Can I train at home?", "Yes. Your plan uses what you have: a full gym, a pair of dumbbells or bands, or just your body."],
    ["I'm on Ozempic or Mounjaro. Is this for me?", "Yes. Banana Shield, included in Training + Nutrition and in your free trial, puts strength training and protein first so the weight you lose is fat, not muscle. It doesn't replace your doctor's advice."],
    ["Can I use pounds and feet?", "Yes. You choose lb and ft/in or kg and cm when you set up your plan, and you can change it later in your profile."],
    ["How do I cancel?", o.faqCancel],
    ["How do I pay?", "With a credit or debit card. Prices are in US dollars (USD). Card details go straight to our payment processor and never touch our servers."],
  ];
};
