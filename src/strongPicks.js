export const DEFAULT_MIN_CONFIDENCE = 58;

export const CONFIDENCE_OPTIONS = [
  { value: 55, label: "≥ 55%" },
  { value: 58, label: "≥ 58%" },
  { value: 60, label: "≥ 60%" },
  { value: 65, label: "≥ 65%" },
  { value: 70, label: "≥ 70%" },
];

export function isStrongPick(confidence, min = DEFAULT_MIN_CONFIDENCE) {
  return typeof confidence === "number" && confidence >= min;
}
