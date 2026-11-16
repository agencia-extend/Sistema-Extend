/** Presença da equipe (quem está com o sistema aberto agora). */
export type PresenceMeta = { id: string; name: string; role: string; at: string };
export type OnlinePerson = { id: string; name: string; role: string; since: string; me: boolean };

/**
 * Junta o estado do canal (uma chave por pessoa, uma entrada por aba aberta) numa lista
 * sem repetição: você primeiro, depois por nome. "since" é a aba aberta há mais tempo.
 */
export function onlinePeople(state: Record<string, PresenceMeta[]>, meId: string): OnlinePerson[] {
  const people: OnlinePerson[] = [];
  for (const metas of Object.values(state)) {
    const valid = metas.filter((m) => m && typeof m.id === "string" && m.id);
    if (!valid.length) continue;
    const first = valid.reduce((a, b) => (a.at <= b.at ? a : b));
    if (people.some((p) => p.id === first.id)) continue;
    people.push({ id: first.id, name: first.name || "Sem nome", role: first.role, since: first.at, me: first.id === meId });
  }
  return people.sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Texto do botão: "Só você online" ou "N online". */
export function onlineLabel(count: number) {
  return count <= 1 ? "Só você online" : `${count} online`;
}
