import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Cabeçalho contextual: trilha, título, descrição e ações.
 * Regra: no máximo UMA ação primária em `actions`.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 px-4 pt-5 pb-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="grid min-w-0 gap-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          // Trilha sem link não leva a lugar nenhum: no celular, só ocuparia espaço.
          <Breadcrumb className={breadcrumbs.some((c) => c.href) ? undefined : "max-md:hidden"}>
            <BreadcrumbList>
              {breadcrumbs.map((c, i) => {
                // A última parte sem link repete o título logo abaixo: em tela estreita ela só empurra o conteúdo.
                const repeatsTitle = i > 0 && i === breadcrumbs.length - 1 && !c.href;
                return (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && <BreadcrumbSeparator className={repeatsTitle ? "max-lg:hidden" : undefined} />}
                  <BreadcrumbItem className={repeatsTitle ? "max-lg:hidden" : undefined}>
                    {c.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={c.href}>{c.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-xl font-semibold tracking-tight wrap-break-word sm:text-2xl lg:truncate">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-sm:*:flex-auto">{actions}</div>}
    </header>
  );
}

export function PageBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 pb-8 sm:px-6", className)}>{children}</div>;
}
