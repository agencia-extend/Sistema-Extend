"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { changePasswordSchema, profileSchema } from "./schemas";

export const updateProfile = defineAction({ schema: profileSchema }, async ({ fullName, phone }, { user }) => {
  const supabase = await createClient();
  must(await supabase.from("profiles").update({ full_name: fullName, phone_e164: phone }).eq("id", user.id));
  revalidatePath("/", "layout");
  return ok(null, "Perfil salvo.");
});

export const changePassword = defineAction({ schema: changePasswordSchema }, async ({ current, password }, { user }) => {
  const supabase = await createClient();
  // Confirma a senha atual antes de trocar.
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (authErr) return fail("validation", "A senha atual está incorreta.", { current: ["A senha atual está incorreta."] });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return fail("validation", "A nova senha precisa ser diferente da atual.");
    return fail("unknown", "Não foi possível trocar a senha. Tente novamente.");
  }
  return ok(null, "Senha alterada.");
});
