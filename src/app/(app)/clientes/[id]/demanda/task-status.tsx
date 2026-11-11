"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setTaskStatus } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/domain/tasks/status";

export function TaskStatusSelect({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={value}
      disabled={disabled || pending}
      onValueChange={(v) => {
        const prev = value;
        setValue(v);
        startTransition(async () => {
          if (!handleResult(await setTaskStatus({ id, status: v as TaskStatus }))) setValue(prev);
        });
      }}
    >
      <SelectTrigger className="w-48" aria-label="Status da demanda"><SelectValue /></SelectTrigger>
      <SelectContent>
        {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
