import type { ModelEsque } from "./providerIconUtils";

/**
 * A lightweight, intentionally approximate cost signal for the picker.
 * Provider pricing is not stable enough to make this a billing display, but
 * the tier gives users a quick way to compare models before selecting one.
 */
export function getModelCostTier(model: Pick<ModelEsque, "slug" | "name">): 1 | 2 | 3 | 4 {
  const searchText = `${model.slug} ${model.name}`.toLowerCase();

  if (searchText.includes("fable")) return 4;
  if (searchText.includes("opus")) return 3;
  if (searchText.includes("sonnet")) return 2;
  if (searchText.includes("haiku")) return 1;
  if (/\b(mini|nano|flash|fast|small|lite)\b/.test(searchText)) return 1;

  // Keep every model, including custom and newly introduced models, visibly
  // ranked until a more specific provider pricing entry is added.
  return 2;
}

export function getModelCostLabel(model: Pick<ModelEsque, "slug" | "name">): string {
  return "$".repeat(getModelCostTier(model));
}
