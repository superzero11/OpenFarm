/**
 * The questions answer engines get asked about OpenFarm.
 *
 * One list, two consumers: the visible FAQ section on the landing page
 * and the FAQPage structured data emitted with it. They must not drift,
 * or the markup would describe answers a reader cannot see, which is
 * exactly what search engines penalise.
 *
 * Message keys live under the "faq" namespace as `<id>.q` and `<id>.a`.
 */
export const FAQ_IDS = [
    "what",
    "stress",
    "satellite",
    "soil",
    "free",
    "selfhost",
    "crops",
    "updates",
] as const;

export type FaqId = (typeof FAQ_IDS)[number];
