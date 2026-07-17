const SUPPORT_WHATSAPP_DEFAULT = "819082272250";
const SUPPORT_WHATSAPP_FEMALE = "201555277198";

/** Support WhatsApp link; female users are directed to the female support line. */
export function supportWhatsAppUrl(gender?: string): string {
  const number = gender === "female" ? SUPPORT_WHATSAPP_FEMALE : SUPPORT_WHATSAPP_DEFAULT;
  return `https://wa.me/${number}`;
}
