export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        Este módulo está en construcción.
      </div>
    </div>
  );
}
