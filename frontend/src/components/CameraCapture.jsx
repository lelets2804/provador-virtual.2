import { useState } from "react";
import { API_URL } from "../services/api";

// O vídeo e a foto vêm da ESP32-CAM, repassados pelo backend (/api/camera).
const URL_STREAM = `${API_URL}/api/camera/stream`;
const URL_CAPTURA = `${API_URL}/api/camera/captura`;

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(blob);
  });
}

export default function CameraCapture({ onFotoCapturada }) {
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [erro, setErro] = useState(null);
  // muda a cada "tirar outra foto" para forçar o navegador a reabrir o stream
  const [chaveStream, setChaveStream] = useState(Date.now());

  async function capturar() {
    setCapturando(true);
    setErro(null);
    try {
      const resposta = await fetch(`${URL_CAPTURA}?_=${Date.now()}`);
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.erro || "Não foi possível capturar a foto.");
      }
      const imagemBase64 = await blobParaBase64(await resposta.blob());
      setFotoPreview(imagemBase64);
      onFotoCapturada(imagemBase64);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCapturando(false);
    }
  }

  const refazer = () => {
    setFotoPreview(null);
    setCameraPronta(false);
    setChaveStream(Date.now());
    onFotoCapturada(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-sans text-ivory-dim text-center max-w-[280px]">
        Fique de frente para a câmara, enquadrando da cintura para cima
      </p>

      <div className="relative w-full max-w-[280px] aspect-[4/5] overflow-hidden rounded-sm border border-brass-dim">
        {/* cantos de latão, como acabamento de moldura de espelho */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brass z-10" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brass z-10" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brass z-10" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brass z-10" />

        {fotoPreview ? (
          <img src={fotoPreview} alt="Foto capturada" className="w-full h-full object-cover" />
        ) : (
          <img
            key={chaveStream}
            src={`${URL_STREAM}?_=${chaveStream}`}
            alt="Câmara ao vivo"
            onLoad={() => setCameraPronta(true)}
            onError={() => setErro("Sem sinal da ESP32-CAM. Confira se ela está ligada e na mesma rede.")}
            className="w-full h-full object-cover"
          />
        )}

        {!cameraPronta && !fotoPreview && !erro && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy text-ivory-dim text-sm font-sans">
            A ligar a câmara…
          </div>
        )}
      </div>

      {erro && <p className="text-xs font-sans text-thread text-center max-w-[280px]">{erro}</p>}

      {fotoPreview ? (
        <button
          type="button"
          onClick={refazer}
          className="text-sm font-sans text-ivory-dim underline decoration-brass-dim underline-offset-4 hover:text-ivory transition-colors"
        >
          Tirar outra foto
        </button>
      ) : (
        <button
          type="button"
          onClick={capturar}
          disabled={capturando}
          className="px-5 py-2 rounded-sm bg-brass text-charcoal font-sans font-semibold text-sm tracking-wide disabled:opacity-40 hover:bg-ivory transition-colors"
        >
          {capturando ? "A capturar…" : "Capturar foto"}
        </button>
      )}
    </div>
  );
}
