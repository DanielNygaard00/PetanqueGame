export function AuthLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-end bg-gradient-to-br from-terracotta to-bordeaux p-10 text-cream md:flex">
        <div className="mb-6 text-6xl">◕ ◕ ◕</div>
        <h1 className="font-display text-4xl">Pétanque · Apéro</h1>
        <p className="mt-2 max-w-sm text-cream/80">Log dine kampe — og hvad der blev drukket imens.</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="mb-6 font-display text-3xl">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
