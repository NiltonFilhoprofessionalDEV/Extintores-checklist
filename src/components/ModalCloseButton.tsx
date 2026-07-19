type ModalCloseButtonProps = {
  onClick: () => void;
  tone?: "light" | "dark";
  className?: string;
};

export default function ModalCloseButton({
  onClick,
  tone = "light",
  className = "",
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl leading-none transition ${
        tone === "dark"
          ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "bg-[var(--muted)] text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      } ${className}`}
      aria-label="Fechar modal"
      title="Fechar"
    >
      ×
    </button>
  );
}
