export default function TelaResultado({ resultado, onReiniciar }) {
  const { imagemFinalUrl, peca } = resultado;
  const justificativa = peca?.justificativa;

  return (
    <div className="h-full flex items-center justify-center gap-10">
      <div className="rounded-sm overflow-hidden border border-brass-dim shadow-2xl shadow-black/50">
        <img
          src={imagemFinalUrl}
          alt={`Look escolhido: ${peca?.modelo_nome ?? ""}`}
          className="block w-auto max-h-[calc(100vh-11rem)]"
        />
      </div>

      <div className="flex flex-col gap-5 max-w-md">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-sans uppercase tracking-[0.25em] text-brass">
            {peca?.cor}
          </span>
          <h2 className="font-display text-3xl text-ivory leading-tight">{peca?.modelo_nome}</h2>
        </div>

        {justificativa && (
          <blockquote className="font-display italic text-lg text-ivory-dim leading-relaxed border-l-2 border-brass pl-4">
            {justificativa}
          </blockquote>
        )}

        <button
          type="button"
          onClick={onReiniciar}
          className="w-full py-3 rounded-sm border border-brass text-brass font-sans font-semibold tracking-wide hover:bg-brass hover:text-charcoal transition-colors"
        >
          Provar outro look
        </button>
      </div>
    </div>
  );
}