import type { MediaKind } from "@/lib/reddit";

type Props = {
  kind: MediaKind;
};

export function MediaTypeBadge({ kind }: Props) {
  let label = "";

  switch (kind) {
    case "gif":
      label = "GIF";
      break;
    case "image":
      label = "IMG";
      break;
    case "video":
    default:
      label = "VIDEO";
      break;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
      <span aria-hidden="true">
        {kind === "video" && "▶"}
        {kind === "gif" && "∞"}
        {kind === "image" && "▢"}
      </span>
      <span>{label}</span>
    </div>
  );
}

