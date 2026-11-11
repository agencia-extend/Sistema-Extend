"use client";

import { useId, useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setNotificationPreference } from "@/features/notifications/actions";
import { handleResult } from "@/lib/action-feedback";

export function PreferenceRow({ kind, label, inApp, push }: { kind: string; label: string; inApp: boolean; push: boolean }) {
  const id = useId();
  const [state, setState] = useState({ inApp, push });
  const [pending, startTransition] = useTransition();

  const save = (next: { inApp: boolean; push: boolean }) => {
    const prev = state;
    setState(next);
    startTransition(async () => {
      const res = await setNotificationPreference({ kind, ...next });
      if (!res.ok) {
        setState(prev);
        handleResult(res);
      }
    });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 border-b px-4 py-2.5 last:border-b-0">
      <span id={id} className="text-sm">
        {label}
      </span>
      <div className="flex justify-center">
        <Switch
          checked={state.inApp}
          disabled={pending}
          aria-label={`${label}: no sistema`}
          onCheckedChange={(v) => save({ inApp: v, push: v ? state.push : false })}
        />
      </div>
      <div className="flex justify-center">
        <Switch
          checked={state.inApp && state.push}
          disabled={pending || !state.inApp}
          aria-label={`${label}: no celular`}
          onCheckedChange={(v) => save({ inApp: state.inApp, push: v })}
        />
      </div>
    </div>
  );
}
