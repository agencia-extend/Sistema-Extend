"use client";

import { Clapperboard, Film, ImagePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PostFormat } from "@/domain/posts";
import type { PublishTarget } from "@/features/posts/queries";
import { ScheduleDialog } from "./schedule-dialog";

const BUTTONS: [PostFormat, string, typeof ImagePlus][] = [
  ["feed", "Post", ImagePlus],
  ["video", "Vídeo", Film],
  ["reels", "Reels", Clapperboard],
  ["stories", "Stories", Smartphone],
];

/** Post, Vídeo, Reels e Stories: abrem a programação já no formato e no perfil escolhidos. */
export function CreateButtons({ clientId, targets, profileId }: { clientId: string; targets: PublishTarget[]; profileId: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Programar">
      {BUTTONS.map(([format, label, Icon]) => (
        <ScheduleDialog key={format} clientId={clientId} targets={targets} initialFormat={format} initialProfile={profileId}
          trigger={<Button variant={format === "feed" ? "default" : "outline"}><Icon aria-hidden="true" /> {label}</Button>} />
      ))}
    </div>
  );
}
