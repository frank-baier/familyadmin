/** Splits a position-sorted ingredient list into consecutive groups by `section` ("Für die Gremolata"). */
export function groupIngredients<T extends { section?: string | null }>(
  ingredients: T[],
): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const ing of ingredients) {
    const section = ing.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push(ing);
    else groups.push({ section, items: [ing] });
  }
  return groups;
}
