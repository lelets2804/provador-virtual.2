import { useState } from "react";
import CameraCapture from "./components/CameraCapture";
import VitrineDePecas from "./components/VitrineDePecas";
import TelaProcessando from "./components/TelaProcessando";
import TelaResultado from "./components/TelaResultado";
import { enviarParaProvador } from "./services/api";

const ETAPAS = ["Foto", "Vitrine", "Provando", "Resultado"];

function base64ParaBlob(base64) {
  const [, dados] = base64.split(",");
  const binario = atob(dados);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

export default function App() {
  const [tela, setTela] = useState("camera"); // camera | vitrine | processando | resultado | erro
  const [fotoBase64, setFotoBase64] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const etapaAtual = { camera: 0, vitrine: 1, processando: 2, resultado: 3, erro: 2 }[tela];

  function irParaVitrine() {
    if (!fotoBase64) return;
    setTela("vitrine");
  }

  async function lidarComSelecaoPeca(pecaSelecionada) {
    setTela("processando");
    setErro(null);
    try {
      const fotoBlob = base64ParaBlob(fotoBase64);
      const resposta = await enviarParaProvador({ fotoBlob, idPeca: pecaSelecionada.id });
      setResultado(resposta);
      setTela("resultado");
    } catch (e) {
      setErro(e.message);
      setTela("erro");
    }
  }

  function reiniciar() {
    setFotoBase64(null);
    setResultado(null);
    setErro(null);
    setTela("camera");
  }

  return (
    <div className="h-screen w-screen textura-tecido flex flex-col overflow-hidden">
      <header className="px-8 pt-3 pb-3 flex items-center justify-between border-b border-brass-dim/30">
        <div className="flex flex-col">
          <h1 className="font-display text-3xl text-ivory leading-none tracking-tight">
            Provador <span className="italic text-brass">Virtual</span>
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-ivory-dim font-sans">
            Alfaiataria assistida por IA
          </p>
        </div>
        <TrenaDeProgresso passoAtual={etapaAtual} />
      </header>

      <main className="flex-1 min-h-0 px-8 pt-2 pb-3 overflow-y-auto">
        {tela === "camera" && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <CameraCapture onFotoCapturada={setFotoBase64} />
            </div>
            <button
              type="button"
              onClick={irParaVitrine}
              disabled={!fotoBase64}
              className="w-full max-w-xl mx-auto py-3 text-base rounded-sm bg-brass text-charcoal font-sans font-semibold tracking-wide disabled:opacity-40 hover:bg-ivory transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {tela === "vitrine" && <VitrineDePecas onSelecionarPeca={lidarComSelecaoPeca} />}
        {tela === "processando" && <TelaProcessando />}
        {tela === "resultado" && resultado && (
          <TelaResultado resultado={resultado} onReiniciar={reiniciar} />
        )}
        {tela === "erro" && (
          <div className="flex flex-col gap-4 text-center py-8">
            <p className="font-display text-lg text-thread">Não foi possível gerar o seu look</p>
            <p className="text-sm text-ivory-dim font-sans">{erro}</p>
            <button
              onClick={reiniciar}
              className="mx-auto px-5 py-2 rounded-sm border border-brass text-brass font-sans text-sm hover:bg-brass hover:text-charcoal transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function TrenaDeProgresso({ passoAtual }) {
  return (
    <div className="flex items-center gap-5">
      {ETAPAS.map((nome, i) => (
        <div key={nome} className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${i <= passoAtual ? "bg-brass" : "bg-brass-dim/30"}`} />
          <span className={`text-xs font-sans ${i === passoAtual ? "text-brass" : "text-ivory-dim/50"}`}>
            {nome}
          </span>
        </div>
      ))}
    </div>
  );
}