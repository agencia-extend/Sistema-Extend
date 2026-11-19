// Leitura do JSON exportado do Trello (Menu do quadro › Imprimir, exportar e compartilhar › Exportar como JSON).
// Fica só o que o quadro da Extend usa: listas abertas, cards não arquivados, etiquetas, checklists, comentários,
// anexos como links e os membros. Roda no navegador (o arquivo pode ter vários MB) e o resumo vai para o servidor.

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Raw[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const isoOrNull = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Cores das etiquetas do Trello (as variantes "_light" e "_dark" usam a mesma). */
export const TRELLO_LABEL: Record<string, { name: string; hex: string }> = {
  green: { name: "Verde", hex: "#61BD4F" },
  yellow: { name: "Amarelo", hex: "#F2D600" },
  orange: { name: "Laranja", hex: "#FF9F1A" },
  red: { name: "Vermelho", hex: "#EB5A46" },
  purple: { name: "Roxo", hex: "#C377E0" },
  blue: { name: "Azul", hex: "#0079BF" },
  sky: { name: "Azul-claro", hex: "#00C2E0" },
  lime: { name: "Verde-limão", hex: "#51E898" },
  pink: { name: "Rosa", hex: "#FF78CB" },
  black: { name: "Preto", hex: "#344563" },
};
const labelOf = (name: string, color: string) => {
  const base = TRELLO_LABEL[color.split("_")[0]];
  const n = name.trim() || base?.name || "Etiqueta";
  return { name: n.slice(0, 40), color: base?.hex ?? "#64748B" };
};

/** Nome de lista que parece "concluído". */
export const looksDone = (name: string) => /conclu|feito|finaliz|entregue|publicad|\bdone\b|aprovad[oa]s?\s*$/i.test(name);

const PALETTE = ["#94A3B8", "#64748B", "#1D8AE6", "#8B5CF6", "#F59E0B", "#0EA5E9", "#EC4899"];

/** Data de criação embutida no id do Trello (os 8 primeiros dígitos são o horário em segundos). */
export function trelloIdDate(id: string): string | null {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  return new Date(Number.parseInt(id.slice(0, 8), 16) * 1000).toISOString();
}

export type TrelloCard = {
  col: number;
  title: string;
  desc: string;
  due: string | null;
  start: string | null;
  created: string | null;
  closedAt: string | null;
  pos: number;
  labels: { name: string; color: string }[];
  memberIds: string[];
  checklist: { title: string; done: boolean }[];
  comments: { author: string; at: string; text: string }[];
  links: { name: string; url: string }[];
};
export type TrelloColumn = { name: string; color: string; done: boolean; cards: number };
export type TrelloMember = { id: string; name: string; cards: number };
export type TrelloBoard = {
  sourceId: string;
  sourceName: string;
  columns: TrelloColumn[];
  cards: TrelloCard[];
  members: TrelloMember[];
  skipped: { archivedCards: number; closedLists: number };
  totals: { comments: number; checklistItems: number; links: number };
  /** O Trello exporta só as 1.000 ações mais recentes: comentários mais antigos podem faltar. */
  commentsMayBeMissing: boolean;
};

export type ParseResult = { ok: true; board: TrelloBoard } | { ok: false; message: string };

export function parseTrello(text: string): ParseResult {
  let raw: Raw;
  try {
    raw = JSON.parse(text) as Raw;
  } catch {
    return { ok: false, message: "O arquivo não é um JSON. No Trello, use Menu › Imprimir, exportar e compartilhar › Exportar como JSON." };
  }
  const sourceId = str(raw?.id);
  if (!raw || typeof raw !== "object" || !/^[0-9a-f]{24}$/.test(sourceId) || !Array.isArray(raw.lists) || !Array.isArray(raw.cards)) {
    return { ok: false, message: "Este arquivo não é a exportação de um quadro do Trello." };
  }
  const lists = arr(raw.lists);
  const open = lists.filter((l) => !l.closed).sort((a, b) => num(a.pos) - num(b.pos));
  if (!open.length) return { ok: false, message: "O quadro não tem listas abertas." };
  const colIndex = new Map(open.map((l, i) => [str(l.id), i]));

  const checklists = new Map<string, Raw[]>();
  for (const c of arr(raw.checklists)) {
    const k = str(c.idCard);
    checklists.set(k, [...(checklists.get(k) ?? []), c]);
  }
  const comments = new Map<string, TrelloCard["comments"]>();
  const actions = arr(raw.actions);
  for (const a of actions) {
    if (a.type !== "commentCard") continue;
    const data = (a.data ?? {}) as Raw;
    const cardId = str((data.card as Raw | undefined)?.id);
    const textBody = str(data.text).trim();
    const at = isoOrNull(a.date);
    if (!cardId || !textBody || !at) continue;
    const author = str((a.memberCreator as Raw | undefined)?.fullName) || str((a.memberCreator as Raw | undefined)?.username) || "Alguém";
    comments.set(cardId, [...(comments.get(cardId) ?? []), { author, at, text: textBody.slice(0, 3800) }]);
  }

  let archivedCards = 0;
  const cards: TrelloCard[] = [];
  const colOf = (c: Raw) => colIndex.get(str(c.idList)) ?? Number.MAX_SAFE_INTEGER;
  const allCards = arr(raw.cards).sort((a, b) => colOf(a) - colOf(b) || num(a.pos) - num(b.pos));
  for (const c of allCards) {
    const col = colIndex.get(str(c.idList));
    if (col === undefined) continue; // lista arquivada: contada em closedLists
    if (c.closed) {
      archivedCards++;
      continue;
    }
    const title = str(c.name).trim().slice(0, 200) || "Card sem título";
    const lists = checklists.get(str(c.id)) ?? [];
    const many = lists.length > 1;
    const checklist = lists
      .sort((a, b) => num(a.pos) - num(b.pos))
      .flatMap((l) =>
        arr(l.checkItems)
          .sort((a, b) => num(a.pos) - num(b.pos))
          .map((i) => ({ title: `${many ? `${str(l.name).trim()}: ` : ""}${str(i.name).trim()}`.slice(0, 200), done: i.state === "complete" }))
          .filter((i) => i.title.trim()),
      );
    const seenLabels = new Set<string>();
    const labels = arr(c.labels)
      .map((l) => labelOf(str(l.name), str(l.color)))
      .filter((l) => !seenLabels.has(l.name) && seenLabels.add(l.name));
    const links = arr(c.attachments)
      .map((a) => ({ name: str(a.name).trim().slice(0, 200), url: str(a.url) }))
      .filter((a) => /^https?:\/\//.test(a.url) && a.url.length <= 1000);
    cards.push({
      col,
      title,
      desc: str(c.desc).slice(0, 10000),
      due: isoOrNull(c.due),
      start: isoOrNull(c.start),
      created: trelloIdDate(str(c.id)),
      closedAt: isoOrNull(c.dateLastActivity),
      pos: 0,
      labels,
      memberIds: Array.isArray(c.idMembers) ? (c.idMembers.filter((x) => typeof x === "string") as string[]) : [],
      checklist,
      comments: (comments.get(str(c.id)) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
      links,
    });
  }
  // Posição dentro da coluna, na ordem do Trello.
  const perCol = new Map<number, number>();
  for (const c of cards) {
    const n = (perCol.get(c.col) ?? 0) + 1;
    perCol.set(c.col, n);
    c.pos = n * 1000;
  }

  const memberCards = new Map<string, number>();
  for (const c of cards) for (const m of c.memberIds) memberCards.set(m, (memberCards.get(m) ?? 0) + 1);
  const members = arr(raw.members)
    .map((m) => ({ id: str(m.id), name: str(m.fullName).trim() || str(m.username) || "Sem nome", cards: memberCards.get(str(m.id)) ?? 0 }))
    .filter((m) => m.id && m.cards > 0);

  let p = 0;
  const columns = open.map((l, i) => {
    const name = str(l.name).trim().slice(0, 60) || `Lista ${i + 1}`;
    const done = looksDone(name);
    return { name, done, color: done ? "#22C55E" : PALETTE[p++ % PALETTE.length], cards: perCol.get(i) ?? 0 };
  });
  // Um quadro sem nada que pareça "concluído" usa a última lista.
  if (!columns.some((c) => c.done) && columns.length > 1) {
    const last = columns[columns.length - 1];
    columns[columns.length - 1] = { ...last, done: true, color: "#22C55E" };
  }

  const commentCount = cards.reduce((s, c) => s + c.comments.length, 0);
  return {
    ok: true,
    board: {
      sourceId,
      sourceName: str(raw.name).trim().slice(0, 200) || "Quadro do Trello",
      columns,
      cards,
      members,
      skipped: { archivedCards, closedLists: lists.length - open.length },
      totals: { comments: commentCount, checklistItems: cards.reduce((s, c) => s + c.checklist.length, 0), links: cards.reduce((s, c) => s + c.links.length, 0) },
      commentsMayBeMissing: actions.length >= 1000,
    },
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Membro do Trello → pessoa da equipe com o mesmo nome (sem acento e maiúsculas). Sem par, fica em branco. */
export function matchMembers(members: TrelloMember[], team: { id: string; name: string }[]): Record<string, string> {
  const byName = new Map<string, string>();
  for (const t of team) {
    const k = norm(t.name);
    byName.set(k, byName.has(k) ? "" : t.id); // nome repetido na equipe: não adivinha
  }
  return Object.fromEntries(members.map((m) => [m.id, byName.get(norm(m.name)) ?? ""]));
}

export type TrelloPayload = {
  sourceId: string;
  sourceName: string;
  name: string;
  columns: { name: string; color: string; done: boolean }[];
  cards: (Omit<TrelloCard, "memberIds"> & { assignee: string | null; participants: string[] })[];
};

/** Resumo enviado ao servidor: o primeiro membro associado fica responsável e os outros participam. */
export function buildPayload(board: TrelloBoard, opts: { name: string; done: boolean[]; members: Record<string, string> }): TrelloPayload {
  return {
    sourceId: board.sourceId,
    sourceName: board.sourceName,
    name: opts.name.trim().slice(0, 60),
    columns: board.columns.map((c, i) => ({ name: c.name, color: opts.done[i] ? "#22C55E" : c.done ? "#64748B" : c.color, done: Boolean(opts.done[i]) })),
    cards: board.cards.map(({ memberIds, ...c }) => {
      const people = [...new Set(memberIds.map((m) => opts.members[m]).filter(Boolean))];
      return { ...c, assignee: people[0] ?? null, participants: people.slice(1) };
    }),
  };
}
