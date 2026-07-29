import arLabels from "react-phone-number-input/locale/ar.json";
import ruLabels from "react-phone-number-input/locale/ru.json";

const PHONE_LABELS: Record<string, typeof arLabels> = {
  ar: arLabels,
  ru: ruLabels,
};

/**
 * Country/UI labels for react-phone-number-input in the given platform
 * locale. Returns undefined for English (the library's built-in default).
 */
export function phoneInputLabels(locale: string): typeof arLabels | undefined {
  return PHONE_LABELS[locale];
}
