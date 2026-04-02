import "server-only";

const dictionaries = {
  en: () => import("./en.json").then((m) => m.default),
  de: () => import("./de.json").then((m) => m.default),
};

export async function getDictionary(lang: string) {
  const loader = dictionaries[lang as keyof typeof dictionaries];
  if (!loader) return dictionaries.en();
  return loader();
}
