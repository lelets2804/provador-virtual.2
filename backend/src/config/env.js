import "dotenv/config";

const obrigatorias = ["FAL_KEY"];

for (const chave of obrigatorias) {
  if (!process.env[chave]) {
    console.error(`[config] Variável de ambiente ausente: ${chave}`);
    console.error("Copie backend/.env.example para backend/.env e preencha as chaves.");
    process.exit(1);
  }
}

export const env = {
  port: process.env.PORT || 3001,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  falKey: process.env.FAL_KEY,
  backendBaseUrl: process.env.BACKEND_BASE_URL || "http://localhost:3001",
  esp32CaptureUrl: process.env.ESP32_CAPTURE_URL || "http://192.168.4.1/capture",
  esp32StreamUrl: process.env.ESP32_STREAM_URL || "http://192.168.4.1:81/stream",
};
