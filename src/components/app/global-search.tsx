"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";

export type SearchPage = { href: string; label: string };
type Person = { id: string; full_name: string; email: string; job_title: string | null };

/** Busca global (Ctrl/⌘ + K): páginas que a pessoa pode abrir e colegas da equipe. */
export function GlobalSearch({ pages, canManageUsers }: { pages: SearchPage[]; canManageUsers: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || people) return;
    createClient()
      .from("profiles")
      .select("id, full_name, email, job_title")
      .eq("is_active", true)
      .is("portal_client_id", null)
      .order("full_name")
      .limit(200)
      .then(({ data, error }: { data: Person[] | null; error: unknown }) => {
        if (error) setFailed(true);
        else setPeople(data as Person[]);
      });
  }, [open, people]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-10 w-full max-w-sm justify-start gap-2 bg-surface text-muted-foreground max-md:hidden"
      >
        <Search aria-hidden="true" />
        <span className="flex-1 text-left">Buscar páginas e pessoas</span>
        <kbd className="rounded border px-1.5 text-[11px] font-medium">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="size-10 md:hidden" onClick={() => setOpen(true)} aria-label="Buscar">
        <Search />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Buscar" description="Busque páginas e pessoas da equipe">
        <CommandInput placeholder="Digite o nome de uma página ou pessoa…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            {pages.map((p) => (
              <CommandItem key={p.href} value={`pagina ${p.label}`} onSelect={() => go(p.href)}>
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Equipe">
            {failed && <p className="px-2 py-1.5 text-sm text-danger">Não foi possível carregar a equipe.</p>}
            {!failed && !people && <p className="px-2 py-1.5 text-sm text-muted-foreground">Carregando…</p>}
            {people?.map((p) => (
              <CommandItem
                key={p.id}
                value={`pessoa ${p.full_name} ${p.email}`}
                onSelect={() => (canManageUsers ? go(`/configuracoes/usuarios/${p.id}`) : setOpen(false))}
              >
                <UserRound aria-hidden="true" />
                <span className="truncate">{p.full_name || p.email}</span>
                {p.job_title && <span className="ml-auto truncate text-xs text-muted-foreground">{p.job_title}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
