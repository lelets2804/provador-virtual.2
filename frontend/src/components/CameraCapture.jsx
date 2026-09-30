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
    setErro(null);
    setChaveStream(Date.now());
    onFotoCapturada(null);
  };

  return (
    <div className="h-full flex flex-col items-center gap-2">
      {/* a moldura ocupa toda a altura disponível */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div className="relative h-full max-w-full aspect-[4/3] overflow-hidden rounded-sm bg-navy ring-1 ring-brass-dim/60 shadow-2xl shadow-black/50">
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
            <div className="absolute inset-0 flex items-center justify-center text-ivory-dim text-lg font-sans">
              A ligar a câmara…
            </div>
          )}

          {/* cantos finos, só para marcar o enquadramento */}
          <span className="absolute top-4 left-4 w-6 h-6 border-t border-l border-ivory/60 z-10" />
          <span className="absolute top-4 right-4 w-6 h-6 border-t border-r border-ivory/60 z-10" />
          <span className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-ivory/60 z-10" />
          <span className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-ivory/60 z-10" />

          {/* faixa na base da imagem: orientação + botão */}
          <div className="absolute inset-x-0 bottom-0 pt-20 pb-6 flex flex-col items-center gap-3 bg-gradient-to-t from-charcoal/80 to-transparent z-20">
            {fotoPreview ? (
              <button
                type="button"
                onClick={refazer}
                className="px-8 py-2.5 rounded-sm bg-charcoal/70 backdrop-blur-sm border border-brass-dim text-ivory font-sans text-base hover:border-brass transition-colors"
              >
                Tirar outra foto
              </button>
            ) : (
              <>
                {cameraPronta && (
                  <p className="text-sm font-sans text-ivory">
                    Fique de frente, enquadrando da cintura para cima
                  </p>
                )}
                <button
                  type="button"
                  onClick={capturar}
                  disabled={capturando}
                  aria-label="Capturar foto"
                  className="group w-[72px] h-[72px] rounded-full border-2 border-brass p-1.5 disabled:opacity-40 transition-opacity"
                >
                  <span
                    className={`block w-full h-full rounded-full bg-brass group-hover:bg-ivory transition-all ${
                      capturando ? "scale-75" : ""
                    }`}
                  />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {erro && <p className="text-sm font-sans text-thread text-center">{erro}</p>}
    </div>
  );
}