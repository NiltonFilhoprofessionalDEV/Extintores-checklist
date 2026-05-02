export default function MapeamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
