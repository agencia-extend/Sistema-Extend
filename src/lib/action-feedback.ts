"use client";

import { toast } from "sonner";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/domain/shared/result";

/** Mostra o resultado de uma Server Action: toast de sucesso, ou erro + erros nos campos. */
export function handleResult<T extends FieldValues>(res: ActionResult<unknown>, form?: { setError: UseFormSetError<T> }): boolean {
  if (res.ok) {
    if (res.message) toast.success(res.message);
    return true;
  }
  if (form && res.fieldErrors) {
    for (const [k, msgs] of Object.entries(res.fieldErrors)) form.setError(k as Path<T>, { message: msgs[0] });
  }
  toast.error(res.message);
  return false;
}
