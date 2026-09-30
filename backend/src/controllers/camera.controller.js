import { Readable } from "node:stream";
import { env } from "../config/env.js";

// A ESP32-CAM (firmware de exemplo "CameraWebServer") expõe:
//   http://<ip>/capture     → um JPEG
//   http://<ip>:81/stream   → vídeo MJPEG
// O backend faz de intermediário para o frontend não esbarrar em CORS
// e para o IP da câmera ficar configurado num lugar só.

export async function capturarFoto(req, res, next) {
  try {
    const resposta = await fetch(`${env.esp32CaptureUrl}?_=${Date.now()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) {
      return res.status(502).json({ erro: `A ESP32-CAM respondeu com status ${resposta.status}.` });
    }
    const imagem = Buffer.from(await resposta.arrayBuffer());
    res.set("Content-Type", resposta.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "no-store");
    res.send(imagem);
  } catch (erro) {
    if (erro.name === "TimeoutError" || erro.cause) {
      return res.status(502).json({ erro: "Não foi possível falar com a ESP32-CAM. Confira se ela está ligada e na mesma rede." });
    }
    next(erro);
  }
}

export async function transmitirVideo(req, res) {
  const controle = new AbortController();
  req.on("close", () => controle.abort());

  try {
    const resposta = await fetch(env.esp32StreamUrl, { signal: controle.signal });
    if (!resposta.ok || !resposta.body) {
      return res.status(502).end();
    }
    res.set("Content-Type", resposta.headers.get("content-type"));
    res.set("Cache-Control", "no-store");
    Readable.fromWeb(resposta.body)
      .on("error", () => res.end())
      .pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).end();
  }
}
