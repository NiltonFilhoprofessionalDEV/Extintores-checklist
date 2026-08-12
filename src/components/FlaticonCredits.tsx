export default function FlaticonCredits({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-relaxed text-slate-400 ${className}`}>
      Ícones:{" "}
      <a
        href="https://www.flaticon.com/br/icones-gratis/fogo"
        title="fogo ícones"
        className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        target="_blank"
        rel="noreferrer"
      >
        Fogo ícones criados por Magnific - Flaticon
      </a>
      {" · "}
      <a
        href="https://www.flaticon.com/br/icones-gratis/hidrante"
        title="hidrante ícones"
        className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        target="_blank"
        rel="noreferrer"
      >
        Hidrante ícones criados por Magnific - Flaticon
      </a>
    </p>
  );
}
