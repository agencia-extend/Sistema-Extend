"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageBody } from "@/components/app/page-header";
import { ErrorState } from "@/components/app/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <PageBody className="pt-6">
      <ErrorState
        offline={offline}
        title={offline ? "Sem conexão" : "Não foi possível carregar esta página"}
        description={offline ? "Verifique sua internet e tente de novo." : "O erro foi registrado. Tente de novo em instantes."}
        action={
          <Button variant="outline" onClick={reset}>
            Tentar de novo
          </Button>
        }
      />
    </PageBody>
  );
}
