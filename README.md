# Provador Virtual — Iniciação Científica FIAP

MVP apresentado no evento **Next**: um estande de alfaiataria onde o cliente
tira uma foto, escolhe uma peça direto numa vitrine e recebe, em segundos,
uma imagem de si mesmo vestindo o look escolhido (gerada pela Fal.ai, com o
modelo FASHN v1.6), acompanhada de uma justificativa curta — um texto fixo,
já cadastrado em cada peça do estoque, sem depender de nenhuma IA para isso.

O único ponto de IA generativa do projeto é a geração da imagem em si.

Fluxo pensado para durar menos de 30 segundos por pessoa: **foto → escolha
da peça na vitrine → resultado**, sem formulário.

## Arquitetura

```
frontend/  → React + Vite + TailwindCSS (câmera, vitrine, resultado)
backend/   → Node.js + Express (orquestra o storage e a Fal.ai, repassa a câmera)
firmware/  → código da ESP32-CAM, a câmera do estande
```

A foto não vem da webcam do computador: vem de uma **ESP32-CAM** ligada no
mesmo Wi-Fi. O backend busca o vídeo e a foto na câmera e repassa para o
frontend (`/api/camera/stream` e `/api/camera/captura`), então o navegador
nunca precisa saber o IP da câmera.

## Pré-requisitos

- **Node.js 20+** e npm instalados (`node -v` para conferir)
- Uma **chave de API da Fal.ai** → [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)
- Uma **ESP32-CAM AI Thinker** com a base USB (ESP32-CAM-MB) e o **Arduino IDE 2**
  instalado com o pacote de placas `esp32` (usamos o `arduino-cli` que vem junto
  com ele para gravar o firmware — veja a seção 3)
- Fotos reais das peças do estoque (paletós, blazers, camisas) — pode manter
  URLs externas (como as do Unsplash já usadas no mock) ou trocar por fotos
  salvas em `backend/public/pecas/`, com nomes batendo com o `estoque.json`

---

## 1. Instalação

Clone/abra o projeto e instale as dependências de cada parte separadamente:

```bash
# Backend
cd backend
npm install

# Frontend (em outro terminal, a partir da raiz do projeto)
cd frontend
npm install
```

---

## 2. Configuração do `.env`

### Backend — `backend/.env`

Copie o exemplo e preencha:

```bash
cd backend
cp .env.example .env
```

Edite `backend/.env` com a sua chave:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não (padrão `3001`) | Porta em que o backend sobe |
| `FRONTEND_ORIGIN` | Sim | URL do frontend, para liberar o CORS (ex: `http://localhost:5173`) |
| `FAL_KEY` | **Sim** | Chave da API da Fal.ai (usada pelo modelo FASHN v1.6 de virtual try-on) |
| `BACKEND_BASE_URL` | Sim | URL pública do próprio backend, usada para montar os links das fotos das peças quando elas são locais (ex: `http://localhost:3001`) |
| `ESP32_CAPTURE_URL` | Sim | Endereço da foto da ESP32-CAM: `http://<ip-da-camera>/capture` |
| `ESP32_STREAM_URL` | Sim | Endereço do vídeo da ESP32-CAM: `http://<ip-da-camera>:81/stream` |

Exemplo preenchido:

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

FAL_KEY=sua_chave_fal_aqui

BACKEND_BASE_URL=http://localhost:3001

ESP32_CAPTURE_URL=http://172.22.0.194/capture
ESP32_STREAM_URL=http://172.22.0.194:81/stream
```

O IP da câmera só é conhecido depois de gravar o firmware — veja a seção 3.

### Frontend — `frontend/.env`

```bash
cd frontend
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Não | URL do backend. Em dev, o proxy do Vite já resolve `/api`, então só é necessário se o front acessar o backend por outro domínio/IP (ex: no estande, via ngrok) |

---

## 3. Câmera ESP32-CAM

O firmware fica em `firmware/esp32-cam/`. Ele já vem com os pinos da placa
AI Thinker e expõe exatamente os dois endereços que o backend usa.

### Gravando o firmware

1. **Wi-Fi:** copie `firmware/esp32-cam/secrets.example.h` para `secrets.h`
   (mesma pasta) e preencha o nome e a senha da rede. A ESP32 **só conecta em
   2.4 GHz**. O `secrets.h` está no `.gitignore`.
2. **Feche o Arduino IDE** (ele ocupa a porta serial) e conecte a placa no USB.
3. Na raiz do projeto:
   ```bash
   npm run cam:gravar          # compila, grava e abre o monitor serial
   npm run cam:gravar -- COM3  # se a placa não estiver na COM6
   ```
   A porta aparece no Gerenciador de Dispositivos como `USB-SERIAL CH340 (COMx)`.
4. Se ficar parado em `Connecting.....`: **segure IO0, dê um toque em RST e
   solte IO0**. Não aperte nada durante o `Writing at 0x...`.
5. Ao terminar, o monitor serial abre sozinho. Dê um toque em **RST** e espere:
   ```
   Pronto! Coloque no backend/.env:
     ESP32_CAPTURE_URL=http://172.22.0.194/capture
     ESP32_STREAM_URL=http://172.22.0.194:81/stream
   ```
6. Copie essas duas linhas para o `backend/.env` e reinicie o backend.
   Saia do monitor com `Ctrl+C`.

Para só ver o IP de novo (sem regravar): `npm run cam:monitor` e toque em RST.

### Ajustes da imagem

No topo de `firmware/esp32-cam/esp32-cam.ino`:

| Constante | Para quê |
|---|---|
| `RESOLUCAO` | `FRAMESIZE_SVGA` (800x600) por padrão. `FRAMESIZE_XGA` dá mais detalhe para a Fal.ai, com o vídeo um pouco mais lento |
| `QUALIDADE_JPEG` | 0–63, menor é melhor |
| `VIRAR_VERTICAL` / `ESPELHAR` | `1` se a imagem sair de cabeça para baixo ou espelhada |

Depois de mudar, rode `npm run cam:gravar` de novo.

### Problemas comuns

| Sintoma | Causa / solução |
|---|---|
| `Could not open COMx, the port doesn't exist` | Porta errada — confira no Gerenciador de Dispositivos e passe com `npm run cam:gravar -- COMx` |
| `Access denied` / porta ocupada | Outro programa usa a porta (Arduino IDE, monitor em outro terminal). Feche-o |
| `No serial data received` | A placa não entrou em modo de gravação — segure IO0, toque em RST, solte IO0 |
| Monitor não mostra nada | Toque em RST. Se usar outro monitor serial, ele precisa estar com DTR e RTS desligados |
| `ERRO: câmera não detectada` (0x105) | Cabo flat da câmera solto: desligue o USB, abra a trava preta, encaixe até o fundo e feche. Se persistir, troque de porta/cabo USB ou o módulo OV2640 |
| `Brownout detector was triggered` | Pouca energia — outra porta USB ou cabo mais curto |
| Não conecta ao Wi-Fi | Nome/senha em `secrets.h`, ou a rede é 5 GHz |
| Frontend fica em "A ligar a câmara…" | A ESP32-CAM só transmite vídeo para **uma** conexão por vez: feche outras abas com a câmera e toque em RST. Confira também se o notebook está na mesma rede e se `http://<ip-da-camera>` abre no navegador |

> O IP pode mudar se a câmera ligar em outra rede ou o roteador reiniciar.
> Se o vídeo sumir, rode `npm run cam:monitor`, pegue o IP novo e atualize o `.env`.

---

## 4. Rodando o projeto localmente

Abra **dois terminais**.

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

Deve aparecer: `Backend do Provador Virtual rodando em http://localhost:3001`

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Deve aparecer algo como: `Local: http://localhost:5173/`

Abra `http://localhost:5173` no navegador (Chrome recomendado). O vídeo da ESP32-CAM deve aparecer na moldura.

### Testando o backend sem o frontend

Primeiro confira o estoque disponível:

```bash
curl http://localhost:3001/api/estoque
```

Depois teste o try-on, usando um `id` retornado acima:

```bash
curl -F "foto=@caminho/para/foto-teste.jpg" \
     -F "id_peca=P001" \
     http://localhost:3001/api/provador
```

---

## 5. Expondo o estande na rede local (tablet/outro computador)

Como a câmera agora é a ESP32-CAM (e não a webcam do navegador), o frontend
**não precisa mais de HTTPS** para funcionar em outro dispositivo. O ngrok
continua sendo a forma mais simples de abrir a aplicação num tablet ou em
outro computador sem mexer em IPs e CORS.

### Passo a passo com ngrok

1. **Instale o ngrok** (uma vez): [ngrok.com/download](https://ngrok.com/download), ou via
   ```bash
   npm install -g ngrok
   ```
2. **Crie uma conta gratuita** em [ngrok.com](https://ngrok.com) e configure o token:
   ```bash
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```
3. **Com o backend e o frontend já rodando** (`npm run dev` nos dois), abra um
   **terceiro terminal** e exponha o frontend (porta `5173`):
   ```bash
   ngrok http 5173
   ```
4. O ngrok vai mostrar uma URL pública HTTPS, algo como:
   ```
   Forwarding   https://a1b2-200-100-50-10.ngrok-free.app -> http://localhost:5173
   ```
   É esse link `https://...ngrok-free.app` que você abre no tablet ou outro
   computador da rede do estande.
5. **Atualize o CORS do backend** para aceitar essa URL: edite
   `backend/.env` e ajuste `FRONTEND_ORIGIN` para a URL do ngrok, depois
   reinicie o backend:
   ```env
   FRONTEND_ORIGIN=https://a1b2-200-100-50-10.ngrok-free.app
   ```

> **Dica para o dia do evento:** a URL gratuita do ngrok muda toda vez que
> você reinicia o túnel. Se possível, deixe o ngrok e os dois servidores
> rodando continuamente durante a apresentação para não precisar reconfigurar
> o `FRONTEND_ORIGIN` no meio do evento. Um plano `ngrok` pago permite fixar
> um subdomínio.

### Alternativa: expor só o frontend, backend continua local

Se o tablet e o computador com o backend estiverem na **mesma rede Wi-Fi**, às
vezes só o frontend precisa de HTTPS (para a câmera) — o backend pode
continuar sendo acessado pelo IP local da máquina (ex: `http://192.168.0.15:3001`),
desde que essa URL esteja em `VITE_API_URL` no `frontend/.env` e liberada em
`FRONTEND_ORIGIN` no backend.

---

## 6. Sobre o modelo de IA usado (FASHN v1.6, via Fal.ai)

O projeto usa o **FASHN v1.6**, rodando na Fal.ai (`fal-ai/fashn/tryon/v1.6`),
para gerar a imagem final. Foi escolhido depois de comparar as opções de
virtual try-on disponíveis hoje: ele preserva melhor estampas e detalhes da
peça, detecta sozinho a categoria da roupa (topo, calça, peça única) sem
precisar de máscara manual, e continua saindo do mesmo SDK e da mesma cobrança
por uso (por token/geração) da Fal.ai — então trocar de modelo no futuro é só
editar a string do endpoint em `falVton.service.js`, sem reescrever a
integração.

Se quiser comparar com outras opções antes do evento, vale reler o estudo
comparativo: [fal.ai/learn/tools/best-virtual-try-on-apis-2026](https://fal.ai/learn/tools/best-virtual-try-on-apis-2026).

---

## 7. Checklist antes de ir para o estande

- [ ] Fotos reais (ou URLs) de todas as peças em `estoque.json`
- [ ] `estoque.json` revisado, com a justificativa de cada peça já escrita
- [ ] Chave `FAL_KEY` testada com créditos suficientes
- [ ] ESP32-CAM gravada com o Wi-Fi do estande (2.4 GHz) e IP atualizado no `backend/.env`
- [ ] Notebook do backend na mesma rede da câmera, com `http://<ip-da-camera>` abrindo no navegador
- [ ] Cabo flat da câmera bem encaixado e fonte/porta USB estável
- [ ] Teste completo do fluxo em uma rede parecida com a do local do evento
- [ ] Túnel ngrok testado com o dispositivo real que será usado no estande
- [ ] Um "look" de exemplo pré-gerado como plano B, caso a internet do evento falhe

---

## Estrutura do projeto

```
provador-virtual/
├── package.json            # atalhos: dev:backend, dev:frontend, cam:gravar, cam:monitor
├── backend/
│   ├── .env.example
│   ├── public/pecas/           # fotos locais das peças (opcional, hoje usamos URLs)
│   └── src/
│       ├── server.js
│       ├── config/env.js
│       ├── data/estoque.json   # inclui a justificativa fixa de cada peça
│       ├── routes/{provador,estoque,camera}.routes.js
│       ├── controllers/{provador,estoque,camera}.controller.js
│       ├── services/{estoque,falVton}.service.js
│       └── middlewares/{upload,errorHandler}.js
├── firmware/
│   └── esp32-cam/
│       ├── esp32-cam.ino       # firmware da câmera (/capture e :81/stream)
│       ├── secrets.example.h   # modelo das credenciais do Wi-Fi (secrets.h fica fora do git)
│       └── gravar.ps1          # compila, grava e abre o monitor serial
└── frontend/
    ├── .env.example
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── components/{CameraCapture,VitrineDePecas,TelaProcessando,TelaResultado}.jsx
        └── services/api.js
```
