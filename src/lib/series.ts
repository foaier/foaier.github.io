import curriculum from "@/content/curriculum.json";

export const series = curriculum;

export function seriesId(name: string) {
  return series.find((item) => item.name === name)?.id ?? "engineering";
}
