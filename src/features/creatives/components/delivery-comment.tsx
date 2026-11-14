"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDeliveryComment } from "@/features/creatives/actions";
import { handleResult } from "@/lib/action-feedback";

export function DeliveryComment({ deliveryId, taskId, version }: { deliveryId: string; taskId: string; version: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          if (handleResult(await addDeliveryComment({ deliveryId, taskId, body }))) {
            setBody("");
            router.refresh();
          }
        });
      }}
    >
      <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} autoComplete="off" placeholder={`Comentar a v${version}…`} aria-label={`Comentário na v${version}`} />
      <Button type="submit" variant="outline" disabled={pending || !body.trim()}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : "Comentar"}</Button>
    </form>
  );
}
