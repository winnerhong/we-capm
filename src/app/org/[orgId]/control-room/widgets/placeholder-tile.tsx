import styles from "../control-room.module.css";

type Props = {
  icon: string;
  label: string;
  hint?: string;
};

export function PlaceholderTile({ icon, label, hint }: Props) {
  return (
    <div
      className={`${styles.surfaceMuted} flex h-full flex-col items-center justify-center gap-2 p-5 text-center`}
    >
      <div className="text-3xl opacity-60" aria-hidden>
        {icon}
      </div>
      <div className="text-xs font-semibold tracking-[0.25em] text-[#7FA892]">
        {label}
      </div>
      <div className="text-[10px] text-[#4e6659]">
        {hint ?? "Phase 2 예정"}
      </div>
    </div>
  );
}
