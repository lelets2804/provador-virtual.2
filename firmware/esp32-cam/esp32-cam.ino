// Firmware da câmera do Provador Virtual (placa AI Thinker ESP32-CAM).
//
// Expõe exatamente o que o backend espera (backend/.env):
//   http://<ip>/capture     → uma foto JPEG   (ESP32_CAPTURE_URL)
//   http://<ip>:81/stream   → vídeo MJPEG      (ESP32_STREAM_URL)
//
// Wi-Fi: copie secrets.example.h para secrets.h e preencha.

#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "secrets.h"

// ---------- ajustes da imagem ----------
// SVGA = 800x600. Suba para FRAMESIZE_XGA (1024x768) se quiser mais detalhe
// na foto enviada à Fal.ai — o vídeo ao vivo fica um pouco mais lento.
#define RESOLUCAO FRAMESIZE_SVGA
#define QUALIDADE_JPEG 10  // 0-63, menor = melhor qualidade
#define VIRAR_VERTICAL 0   // 1 se a imagem aparecer de cabeça para baixo
#define ESPELHAR 0         // 1 se a imagem aparecer espelhada

// ---------- pinos da AI Thinker ESP32-CAM ----------
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#define FLASH_GPIO_NUM 4

#define PART_BOUNDARY "provadorvirtualframe"
static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t servidorFoto = NULL;
httpd_handle_t servidorStream = NULL;

bool iniciarCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = RESOLUCAO;
    config.jpeg_quality = QUALIDADE_JPEG;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;  // /capture sempre pega o quadro mais recente
  } else {
    Serial.println("Aviso: PSRAM não encontrada, usando resolução menor (VGA).");
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  // Algumas placas só detectam o sensor depois de um ciclo de energia na câmera.
  for (int tentativa = 1; tentativa <= 3; tentativa++) {
    pinMode(PWDN_GPIO_NUM, OUTPUT);
    digitalWrite(PWDN_GPIO_NUM, HIGH);
    delay(100);
    digitalWrite(PWDN_GPIO_NUM, LOW);
    delay(100);

    esp_err_t erro = esp_camera_init(&config);
    if (erro == ESP_OK) {
      sensor_t *sensor = esp_camera_sensor_get();
      sensor->set_vflip(sensor, VIRAR_VERTICAL);
      sensor->set_hmirror(sensor, ESPELHAR);
      return true;
    }
    Serial.printf("Tentativa %d: falha ao iniciar a câmera (erro 0x%x)\n", tentativa, erro);
    esp_camera_deinit();
    delay(500);
  }
  return false;
}

esp_err_t rotaInicio(httpd_req_t *req) {
  const char *pagina =
    "<html><body style='font-family:sans-serif;background:#111;color:#eee'>"
    "<h3>ESP32-CAM do Provador Virtual</h3>"
    "<p><a href='/capture' style='color:#d4a857'>/capture</a> (foto)</p>"
    "<img id='v' style='max-width:100%'>"
    "<script>document.getElementById('v').src='http://'+location.hostname+':81/stream'</script>"
    "</body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, pagina, HTTPD_RESP_USE_STRLEN);
}

esp_err_t rotaCaptura(httpd_req_t *req) {
  camera_fb_t *quadro = esp_camera_fb_get();
  if (!quadro) {
    Serial.println("Falha ao capturar quadro");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t resultado = httpd_resp_send(req, (const char *)quadro->buf, quadro->len);
  esp_camera_fb_return(quadro);
  return resultado;
}

esp_err_t rotaStream(httpd_req_t *req) {
  char cabecalho[64];
  esp_err_t resultado = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (resultado != ESP_OK) return resultado;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  // Envia quadros até o cliente desconectar.
  while (true) {
    camera_fb_t *quadro = esp_camera_fb_get();
    if (!quadro) {
      Serial.println("Falha ao capturar quadro do stream");
      return ESP_FAIL;
    }
    size_t tamanho = snprintf(cabecalho, sizeof(cabecalho), STREAM_PART, quadro->len);
    resultado = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (resultado == ESP_OK) resultado = httpd_resp_send_chunk(req, cabecalho, tamanho);
    if (resultado == ESP_OK) resultado = httpd_resp_send_chunk(req, (const char *)quadro->buf, quadro->len);
    esp_camera_fb_return(quadro);
    if (resultado != ESP_OK) return resultado;
  }
}

void iniciarServidores() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();

  // Porta 80: página de teste e /capture
  config.server_port = 80;
  if (httpd_start(&servidorFoto, &config) == ESP_OK) {
    httpd_uri_t inicio = { .uri = "/", .method = HTTP_GET, .handler = rotaInicio, .user_ctx = NULL };
    httpd_uri_t captura = { .uri = "/capture", .method = HTTP_GET, .handler = rotaCaptura, .user_ctx = NULL };
    httpd_register_uri_handler(servidorFoto, &inicio);
    httpd_register_uri_handler(servidorFoto, &captura);
  }

  // Porta 81: /stream fica num servidor separado para não travar o /capture
  config.server_port = 81;
  config.ctrl_port += 1;
  if (httpd_start(&servidorStream, &config) == ESP_OK) {
    httpd_uri_t stream = { .uri = "/stream", .method = HTTP_GET, .handler = rotaStream, .user_ctx = NULL };
    httpd_register_uri_handler(servidorStream, &stream);
  }
}

bool conectarWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // sem economia de energia: o vídeo fica bem mais fluido
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("Conectando ao Wi-Fi \"%s\"", WIFI_SSID);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - inicio > 20000) {
      Serial.println();
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  return true;
}

void reiniciarEm(int segundos) {
  Serial.printf("Reiniciando em %d segundos...\n\n", segundos);
  delay(segundos * 1000);
  ESP.restart();
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("=== Provador Virtual — ESP32-CAM ===");

  // O LED de flash (GPIO 4) às vezes acende sozinho no boot.
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  if (!iniciarCamera()) {
    Serial.println();
    Serial.println("ERRO: câmera não detectada. Verifique:");
    Serial.println("  1. Cabo flat da câmera: desligue o USB, abra a trava preta,");
    Serial.println("     encaixe o cabo até o fundo (contatos virados para a placa) e feche.");
    Serial.println("  2. Energia: troque de porta USB ou de cabo.");
    Serial.println("  3. Se nada resolver, o módulo OV2640 pode estar com defeito.");
    reiniciarEm(10);
  }
  Serial.println("Câmera OK");

  if (!conectarWifi()) {
    Serial.println("ERRO: não conectou ao Wi-Fi. Confira nome/senha em secrets.h");
    Serial.println("e se a rede é 2.4 GHz (a ESP32 não conecta em 5 GHz).");
    reiniciarEm(5);
  }

  iniciarServidores();

  String ip = WiFi.localIP().toString();
  Serial.println("Pronto! Coloque no backend/.env:");
  Serial.println("  ESP32_CAPTURE_URL=http://" + ip + "/capture");
  Serial.println("  ESP32_STREAM_URL=http://" + ip + ":81/stream");
  Serial.println("Teste no navegador: http://" + ip);
}

void loop() {
  delay(10000);
}
