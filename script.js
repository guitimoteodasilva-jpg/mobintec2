/* ==========================================================================
   MOBINTEC - script do site
   Tudo foi escrito de forma simples, em português, com uma ideia por linha.
   Partes: 1) ajudantes  2) dados  3) fala  4) telas  5) mapa  6) microfone
           7) assistente  8) painel do ônibus  9) ligações dos botões
   ========================================================================== */

/* ---------- 1) Ajudantes ---------- */

// Pega um elemento da página pelo seletor (ex.: "#botaoVoltar").
function pegar(seletor) {
  return document.querySelector(seletor);
}

// Deixa o texto em minúsculas e sem acentos, para comparar palavras.
function semAcento(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Sorteia um número inteiro de 0 até max - 1.
function sortear(max) {
  return Math.floor(Math.random() * max);
}

// Escreve uma distância em metros ou quilômetros.
function formatarDistancia(metros) {
  if (metros < 1000) {
    return Math.round(metros) + " metros";
  }
  return (metros / 1000).toFixed(1).replace(".", ",") + " km";
}

// Distância em metros entre dois pontos [latitude, longitude]. Não depende do mapa.
function distanciaEntre(a, b) {
  const raio = 6371000;
  const grau = Math.PI / 180;
  const dLat = (b[0] - a[0]) * grau;
  const dLon = (b[1] - a[1]) * grau;
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a[0] * grau) * Math.cos(b[0] * grau) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * raio * Math.asin(Math.sqrt(x));
}

// Mostra ou esconde um elemento, avisando também os leitores de tela.
function mostrar(elemento, visivel) {
  elemento.hidden = !visivel;
  elemento.setAttribute("aria-hidden", visivel ? "false" : "true");
}

/* ---------- 2) Dados do projeto ---------- */

// Quantos segundos "passam" a cada segundo real no teste. Use 1 para tempo real.
const VELOCIDADE_TESTE = 5;

// Endereço da função da assistente de IA (veja a pasta "ia"). Deixe vazio ("") para desligar a IA.
const URL_DA_IA = "https://ia.pdeoliveiraalves840.workers.dev";


const BOAS_VINDAS = "Bem-vindo ao Mobintec, o aplicativo dos ônibus turísticos de Foz do Iguaçu. " +
  "Toque em qualquer lugar da tela e diga o destino: Cataratas, Parque das Aves, Itaipu, " +
  "Marco das Três Fronteiras ou Templo Budista. Se você usa leitor de tela, vá até o botão Falar o destino e toque duas vezes. " +
  "Depois você pode perguntar sobre o ônibus, o assento, a rota e hotéis próximos.";

const TEXTO_AJUDA = "Você pode dizer: o nome de um destino, como Cataratas; quando o ônibus chega; acessibilidade; " +
  "tem assento livre; qual a rota; tema claro; tema escuro; hotéis perto; onde estou; repetir; mais devagar; mais rápido; " +
  "silêncio; desligar a voz; ou voltar.";

// Devolve o destino citado em um texto, ou null se não achar nenhum.
function acharDestino(texto) {
  const limpo = semAcento(texto);
  for (const destino of DESTINOS) {
    for (const palavra of destino.palavras) {
      if (limpo.includes(palavra)) {
        return destino;
      }
    }
  }
  return null;
}

/* ---------- 3) Fala, sons e vibração ---------- */

let ultimaFala = "";      // guarda a última mensagem, para o botão "Repetir"
let velocidadeVoz = 1;
let vozLigada = true;      // false = o site não fala (bom para quem já usa leitor de tela)    // 1 = normal

// O site fala o texto em voz alta (se o navegador tiver voz).
function falar(texto, naFila) {
  ultimaFala = texto;
  if (!vozLigada || !window.speechSynthesis) {
    return;
  }
  if (!naFila) {
    window.speechSynthesis.cancel();   // corta a fala anterior
  }
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = velocidadeVoz;
  window.speechSynthesis.speak(fala);
}

// Mostra a mensagem na tela e também fala.
function avisar(texto) {
  pegar("#textoEstado").textContent = texto;
  pegar("#textoResposta").textContent = texto;
  falar(texto);
}

// Toca um bipe curto (agudo = começou a ouvir, grave = terminou).
function apitar(frequencia) {
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const tom = audio.createOscillator();
    tom.frequency.value = frequencia;
    tom.connect(audio.destination);
    tom.start();
    tom.stop(audio.currentTime + 0.12);
  } catch (erro) {
    // sem som: tudo bem, o resto continua funcionando
  }
}

// Faz o celular vibrar (só funciona em alguns aparelhos).
function vibrar(padrao) {
  if (navigator.vibrate) {
    navigator.vibrate(padrao);
  }
}

/* ---------- 4) Telas ---------- */

// Para os avisos do ônibus (quando a pessoa volta ao início para escolher outro destino).
function pararAcompanhamento() {
  clearInterval(relogioDoTempo);
  clearInterval(relogioDaCamera);
  numeroDaEscolha = numeroDaEscolha + 1;   // ignora respostas atrasadas
  destinoAtual = null;
  dados = null;
  mostrar(pegar("#painel"), false);
}

// Volta ao início. Funciona também com o botão "voltar" do aparelho.
function voltar() {
  if (history.state && history.state.tela === "lista") {
    history.back();
  } else {
    abrirTela("inicio");
  }
}

function abrirTela(nome, silencioso) {
  pararMicrofone();
  mostrar(pegar("#telaInicio"), nome === "inicio");
  mostrar(pegar("#telaLista"), nome === "lista");
  if (nome === "lista") {
    criarMapa();
    try {
      if (!(history.state && history.state.tela === "lista")) {
        history.pushState({ tela: "lista" }, "");   // para o botão "voltar" do aparelho voltar ao início
      }
    } catch (erro) { }
    pegar("#tituloLista").focus();
    falar("Ônibus turísticos. Escolha um destino.");
  } else {
    pararAcompanhamento();
    limparBolhas();
    tocarEmQualquerLugar = true;
    if (!silencioso) { falar("Tela inicial. Toque em qualquer lugar e diga o destino."); }
    pegar("#tituloInicio").focus();
  }
  window.scrollTo(0, 0);
}

/* ---------- 5) Mapa (Leaflet + OpenStreetMap) ---------- */

let mapa = null;          // o mapa
let camada = null;        // desenhos da rota atual
let marcadorOnibus = null;
let marcadorVoce = null;
let distanciaAteVoce = null;

// Cria um pino redondo com um texto dentro.
function criarPino(texto, corFundo, corTexto, tamanho) {
  return L.divIcon({
    className: "",
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    html: '<div class="pino" style="width:' + tamanho + 'px;height:' + tamanho + 'px;background:' +
      corFundo + ';color:' + corTexto + '">' + texto + "</div>"
  });
}

function criarMapa() {
  if (!window.L) {
    pegar("#mensagemMapa").textContent = "O mapa não carregou. Tudo continua disponível em texto.";
    return;
  }
  if (mapa) {
    setTimeout(function () { mapa.invalidateSize(); }, 60);
    return;
  }
  mapa = L.map("mapa", { keyboard: false, zoomControl: false, attributionControl: false });
  mapa.setView(EMBARQUE.posicao, 11);

  // Mapa de fundo (muda com o tema). Se o da Esri falhar, usa o OpenStreetMap.
  trocarFundoDoMapa();

  camada = L.layerGroup().addTo(mapa);

  // Pino do embarque e um pino para cada destino.
  L.marker(EMBARQUE.posicao, { icon: criarPino("E", "#ffffff", "#0d0a0b", 36), keyboard: false }).addTo(mapa);
  DESTINOS.forEach(function (destino, indice) {
    const pino = L.marker(destino.posicao, { icon: criarPino(destino.sigla, "#8b1f2f", "#ffffff", 36), keyboard: false });
    pino.on("click", function () { escolherDestino(indice); });
    pino.addTo(mapa);
  });
  setTimeout(function () { mapa.invalidateSize(); }, 60);
}

// Fundo do mapa conforme o tema (Esri: cinza claro ou escuro, sem chave). Se falhar, usa o OpenStreetMap.
let fundoMapa = null;
let usandoMapaReserva = false;
function trocarFundoDoMapa() {
  if (!mapa) { return; }
  if (fundoMapa) { mapa.removeLayer(fundoMapa); }

  if (usandoMapaReserva) {
    fundoMapa = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapa);
    return;
  }

  const estilo = document.body.classList.contains("claro") ? "World_Light_Gray_Base" : "World_Dark_Gray_Base";
  const camadaEsri = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/" + estilo + "/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16 });
  camadaEsri.once("tileerror", function () {
    usandoMapaReserva = true;
    pegar("#mensagemMapa").textContent = "Usando o mapa reserva.";
    trocarFundoDoMapa();
  });
  camadaEsri.addTo(mapa);
  fundoMapa = camadaEsri;
}

// Cor da rota no mapa: rosé no tema escuro, bordô no tema claro (para ter contraste).
function corDaRota() {
  return document.body.classList.contains("claro") ? "#a9583e" : "#ffb3c4";
}

// Liga ou desliga a voz do site. Quem usa leitor de tela pode desligar para não ouvir duas vozes ao mesmo tempo.
function definirVoz(ligada, anunciar) {
  vozLigada = ligada;
  if (!ligada && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const botao = pegar("#botaoVoz");
  botao.textContent = ligada ? "Voz do site: ligada" : "Voz do site: desligada";
  botao.setAttribute("aria-label", ligada
    ? "Voz do site ligada. Toque para desligar. Desligue se você já usa um leitor de tela."
    : "Voz do site desligada. Toque para ligar.");
  try { localStorage.setItem("mobintecVoz", ligada ? "ligada" : "desligada"); } catch (e) { }
  if (anunciar) {
    pegar("#textoEstado").textContent = ligada ? "Voz do site ligada." : "Voz do site desligada. Os avisos continuam escritos na tela.";
    falar("Voz do site ligada.");   // só fala se ela estiver ligada
  }
}

// Repete a última mensagem: falando, ou só escrevendo se a voz do site estiver desligada.
function repetirUltima() {
  if (vozLigada) {
    falar(ultimaFala);
    return;
  }
  const estado = pegar("#textoEstado");
  estado.textContent = "";
  setTimeout(function () { estado.textContent = ultimaFala; }, 40);   // texto novo faz o leitor de tela ler
}

// Tema claro ou escuro (fica salvo no aparelho).
function aplicarTema(claro, anunciar) {
  document.body.classList.toggle("claro", claro);
  const botao = pegar("#botaoTema");
  botao.textContent = claro ? "Tema escuro" : "Tema claro";
  botao.setAttribute("aria-label", claro ? "Trocar para tema escuro" : "Trocar para tema claro");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", claro ? "#fdf6f7" : "#0d0a0b");
  try { localStorage.setItem("mobintecTema", claro ? "claro" : "escuro"); } catch (e) { }
  trocarFundoDoMapa();
  if (camada) {
    camada.eachLayer(function (item) {
      if (item.setStyle) { item.setStyle({ color: corDaRota() }); }
    });
  }
  if (anunciar) { avisar(claro ? "Tema claro ativado." : "Tema escuro ativado."); }
}

/* ---------- 6) Microfone ---------- */

const ReconhecimentoDoNavegador = window.SpeechRecognition || window.webkitSpeechRecognition;
let usarModeloProprio = !ReconhecimentoDoNavegador;  // true = usa o plano B (Whisper)

let reconhecimento = null;   // reconhecimento de voz do navegador
let ouvindo = false;
let iniciando = false;       // evita dois toques seguidos criarem dois reconhecimentos
let entendeu = false;        // já entendi o que a pessoa disse?

let gravador = null;         // plano B: gravador de áudio
let fluxoDoMicrofone = null;
let gravando = false;
let processando = false;
let gravacaoCancelada = false;
let transcritor = null;      // plano B: modelo que transforma voz em texto

// Para tudo o que estiver ouvindo ou gravando.
// Destaca a bolha do destino entendido (ela cresce e pulsa) e apaga as outras.
function destacarBolha(destino) {
  document.querySelectorAll(".bolha").forEach(function (bolha, indice) {
    bolha.classList.toggle("ativa", DESTINOS[indice] === destino);
    bolha.classList.toggle("apagada", DESTINOS[indice] !== destino);
  });
}

function limparBolhas() {
  document.querySelectorAll(".bolha").forEach(function (bolha) {
    bolha.classList.remove("ativa", "apagada");
  });
}

function pararMicrofone() {
  if (reconhecimento && (ouvindo || iniciando)) {
    try { reconhecimento.abort(); } catch (erro) { }
  }
  if (gravando) {
    gravacaoCancelada = true;
    gravador.stop();
  }
  ouvindo = false;
  iniciando = false;
  pegar("#anel").classList.remove("ouvindo");
  pegar("#botaoMicrofone").setAttribute("aria-pressed", "false");
  pegar("#botaoPerguntar").setAttribute("aria-pressed", "false");
}

// Chamado quando a pessoa toca no microfone (ou em qualquer lugar da tela inicial).
function tocarMicrofone(botao) {
  if (iniciando) {
    return;
  }
  if (ouvindo) {
    pararMicrofone();
    avisar("Microfone desligado.");
    return;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  limparBolhas();
  if (usarModeloProprio) {
    ouvirComModeloProprio(botao);
  } else {
    ouvirComNavegador(botao);
  }
}

// Plano A: voz do próprio navegador (Chrome, Edge, Safari).
function ouvirComNavegador(botao) {
  const este = new ReconhecimentoDoNavegador();
  reconhecimento = este;
  este.lang = "pt-BR";
  este.interimResults = true;
  entendeu = false;
  iniciando = true;
  pegar("#textoOuvido").textContent = "";

  este.onstart = function () {
    if (este !== reconhecimento) { return; }
    iniciando = false;
    ouvindo = true;
    apitar(880);
    pegar("#anel").classList.add("ouvindo");
    botao.setAttribute("aria-pressed", "true");
    pegar("#textoEstado").textContent = "Ouvindo… fale agora.";
  };

  este.onresult = function (evento) {
    if (este !== reconhecimento || entendeu) { return; }
    let texto = "";
    for (const resultado of evento.results) {
      texto += " " + resultado[0].transcript;
    }
    pegar("#textoOuvido").textContent = texto.trim();

    const ultimo = evento.results[evento.results.length - 1];
    if (acharDestino(texto) || ultimo.isFinal) {
      entendeu = true;
      pararMicrofone();
      responder(texto);
    }
  };

  este.onerror = function (evento) {
    if (este !== reconhecimento) { return; }
    iniciando = false;
    const erro = evento.error;

    // Se o serviço de voz do navegador não funciona, passa para o plano B.
    if (erro === "network" || erro === "service-not-allowed" || erro === "language-not-supported") {
      entendeu = true;
      usarModeloProprio = true;
      avisar("A voz do navegador não está disponível. Usando a voz do próprio site.");
      ouvirComModeloProprio(botao);
    } else if (erro === "not-allowed") {
      entendeu = true;
      avisar("Permissão do microfone negada. Libere o microfone nas configurações do navegador ou escolha o destino na lista.");
    } else if (erro === "no-speech") {
      entendeu = true;
      avisar("Não ouvi nada. Toque e fale de novo.");
    } else if (erro === "audio-capture") {
      entendeu = true;
      avisar("Nenhum microfone encontrado.");
    }
  };

  este.onend = function () {
    if (este !== reconhecimento) { return; }
    const estavaOuvindo = ouvindo;
    pararMicrofone();
    if (estavaOuvindo) {
      apitar(440);
      if (!entendeu) {
        avisar("Não entendi. Toque e diga, por exemplo, Cataratas.");
      }
    }
  };

  // Se o navegador não responder em 10 segundos, libera o botão.
  setTimeout(function () {
    if (este === reconhecimento && iniciando) {
      iniciando = false;
      avisar("O microfone demorou para responder. Toque de novo ou escolha o destino na lista.");
    }
  }, 10000);

  try {
    este.start();
  } catch (erro) {
    iniciando = false;
    avisar("Não consegui ligar o microfone. Escolha o destino na lista.");
  }
}

// Plano B: grava 6 segundos e transforma em texto com o modelo Whisper (roda no próprio aparelho).
// Baixa cerca de 40 MB na primeira vez e depois fica guardado no navegador.
async function ouvirComModeloProprio(botao) {
  if (gravando) {
    gravador.stop();       // segundo toque: termina a gravação antes
    return;
  }
  if (processando) {
    return;
  }
  try {
    fluxoDoMicrofone = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (erro) {
    avisar("Não consegui usar o microfone. Libere a permissão nas configurações do navegador ou escolha o destino na lista.");
    return;
  }

  const pedacos = [];
  gravacaoCancelada = false;
  gravador = new MediaRecorder(fluxoDoMicrofone);
  const esteGravador = gravador;

  gravador.ondataavailable = function (evento) {
    pedacos.push(evento.data);
  };

  gravador.onstop = async function () {
    gravando = false;
    fluxoDoMicrofone.getTracks().forEach(function (faixa) { faixa.stop(); });
    pegar("#anel").classList.remove("ouvindo");
    botao.setAttribute("aria-pressed", "false");
    if (gravacaoCancelada) {
      return;
    }
    apitar(440);
    processando = true;
    avisar("Entendendo o que você disse…");
    try {
      const audioBruto = await new Blob(pedacos, { type: esteGravador.mimeType }).arrayBuffer();
      const contexto = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const audio = await contexto.decodeAudioData(audioBruto);
      contexto.close();
      const modelo = await carregarModelo();
      const resultado = await modelo(audio.getChannelData(0), { language: "portuguese", task: "transcribe" });
      pegar("#textoOuvido").textContent = resultado.text.trim();
      responder(resultado.text);
    } catch (erro) {
      avisar("Não consegui entender o áudio. Verifique a internet ou escolha o destino na lista.");
    }
    processando = false;
  };

  gravador.start();
  gravando = true;
  apitar(880);
  pegar("#anel").classList.add("ouvindo");
  botao.setAttribute("aria-pressed", "true");
  pegar("#textoEstado").textContent = "Ouvindo… fale agora e toque de novo para terminar.";
  setTimeout(function () {
    if (esteGravador.state === "recording") {
      esteGravador.stop();
    }
  }, 6000);
}

async function carregarModelo() {
  if (transcritor) {
    return transcritor;
  }
  const biblioteca = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.web.min.js");
  transcritor = await biblioteca.pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
    progress_callback: function (progresso) {
      if (progresso.status === "progress") {
        pegar("#textoEstado").textContent = "Baixando a voz do site: " + Math.round(progresso.progress) + "% (só na primeira vez)";
      }
    }
  });
  return transcritor;
}

/* ---------- 7) Assistente: entende o que a pessoa falou ou digitou ---------- */

function responder(texto) {
  // 1) A pessoa citou um destino?
  const destino = acharDestino(texto);
  if (destino) {
    tocarEmQualquerLugar = false;   // a partir daqui, tocar em qualquer lugar não liga mais o microfone
    pegar("#textoOuvido").textContent = "“" + texto.trim() + "”";
    destacarBolha(destino);
    avisar("Entendi: " + destino.nome + ".");
    setTimeout(function () {
      abrirTela("lista");
      escolherDestino(DESTINOS.indexOf(destino));
    }, 700);
    return;
  }

  // Com a IA ligada, frases longas são conversa livre e vão direto para ela (os comandos são frases curtas).
  if (URL_DA_IA && texto.trim().split(/\s+/).length > 5) {
    perguntarParaIA(texto);
    return;
  }

  // 2) Comandos gerais (funcionam em qualquer momento).
  const t = semAcento(texto);
  if (t.includes("claro") && (t.includes("tema") || t.includes("modo") || t.includes("fundo") || t.split(" ").length <= 2)) { aplicarTema(true, true); return; }
  if (t.includes("escuro") && (t.includes("tema") || t.includes("modo") || t.includes("fundo") || t.split(" ").length <= 2)) { aplicarTema(false, true); return; }
  if (t.includes("tema") || t.includes("trocar cor")) { aplicarTema(!document.body.classList.contains("claro"), true); return; }
  if (t.includes("repet") || t.includes("de novo")) { repetirUltima(); return; }
  if (t.includes("devagar") || t.includes("lent")) { mudarVelocidade(velocidadeVoz - 0.2); return; }
  if (t.includes("rapido") || t.includes("depressa")) { mudarVelocidade(velocidadeVoz + 0.2); return; }
  if (t.includes("voz") && (t.includes("desligar") || t.includes("desativar"))) { definirVoz(false, true); return; }
  if (t.includes("voz") && (t.includes("ligar") || t.includes("ativar"))) { definirVoz(true, true); return; }
  if (t.includes("silencio") || t.includes("parar de falar")) {
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    return;
  }
  if (t.includes("ajuda") || t.includes("comandos")) { avisar(TEXTO_AJUDA); return; }
  if (t.includes("voltar") || t.includes("inicio")) { voltar(); return; }
  if (t.includes("onde estou") || t.includes("localizacao")) { descobrirLocalizacao(); return; }

  // 3) Perguntas sobre o ônibus (precisam de um destino já escolhido).
  if (!destinoAtual) {
    if (URL_DA_IA) { perguntarParaIA(texto); return; }
    avisar("Primeiro diga um destino, por exemplo Cataratas.");
    return;
  }
  if (t.includes("acessibilidade") || t.includes("rampa")) { mostrarAba("Onibus"); avisar(textoAcessibilidade()); return; }
  if (t.includes("hotel") || t.includes("perto") || t.includes("proxim")) { mostrarAba("Perto"); avisar(textoHoteis()); return; }
  if (t.includes("assento") || t.includes("poltrona") || t.includes("lugar") || t.includes("livre")) { mostrarAba("Onibus"); avisar(textoAssento()); return; }
  if (t.includes("rota") || t.includes("caminho") || t.includes("linha") || t.includes("distancia")) { mostrarAba("Rota"); avisar(textoRota()); return; }
  if (t.includes("onibus") || t.includes("chega") || t.includes("minuto") || t.includes("tempo") || t.includes("onde")) { mostrarAba("Onibus"); avisar(frasePrincipal()); return; }

  if (URL_DA_IA) { perguntarParaIA(texto); return; }
  avisar("Não entendi. Diga ajuda para ouvir os comandos.");
}

// Assistente de IA: conversa livre. O servidor (pasta "ia") guarda a chave e recebe só o texto e o contexto.
// O tempo do ônibus e o assento PCD vêm sempre dos dados do site, a IA só conversa sobre eles.
let conversa = [];   // últimas mensagens, para a IA lembrar do assunto

async function perguntarParaIA(texto) {
  pegar("#textoEstado").textContent = "Pensando…";
  pegar("#textoResposta").textContent = "Pensando…";
  let contexto = { destino: "nenhum escolhido ainda" };
  if (destinoAtual && dados) {
    contexto = { destino: destinoAtual.nome, descricao: destinoAtual.descricao, servico: destinoAtual.servico, acessibilidade: destinoAtual.acessibilidade, aConfirmar: destinoAtual.aConfirmar, status: frasePrincipal(), rota: textoRota(), hoteis: textoHoteis() };
    mostrarAba("Assistente");
  }
  try {
    const controle = new AbortController();
    const prazo = setTimeout(function () { controle.abort(); }, 15000);
    const resposta = await fetch(URL_DA_IA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta: texto, historico: conversa, contexto: contexto }),
      signal: controle.signal
    });
    clearTimeout(prazo);
    const json = await resposta.json();
    if (!resposta.ok || !json.resposta) { throw new Error(json.detalhe || json.erro || "sem resposta"); }
    conversa.push({ role: "user", content: texto });
    conversa.push({ role: "assistant", content: json.resposta });
    conversa = conversa.slice(-6);
    avisar(json.resposta);
  } catch (erro) {
    console.warn("Erro da assistente de IA:", erro);   // aparece no Console (F12) para ajudar a achar o problema
    avisar("Não consegui falar com a assistente agora. Diga ajuda para ouvir os comandos.");
  }
}

function mudarVelocidade(nova) {
  velocidadeVoz = Math.min(1.6, Math.max(0.6, nova));
  try { localStorage.setItem("mobintecVelocidade", velocidadeVoz); } catch (e) { }
  falar("Velocidade da voz alterada.");
}

// Mostra onde a pessoa está (só quando ela pede). O navegador vai pedir permissão.
function descobrirLocalizacao() {
  if (!navigator.geolocation) {
    avisar("Este navegador não tem localização.");
    return;
  }
  navigator.geolocation.getCurrentPosition(function (posicao) {
    const ponto = [posicao.coords.latitude, posicao.coords.longitude];
    distanciaAteVoce = distanciaEntre(ponto, EMBARQUE.posicao);
    if (mapa) {
      if (marcadorVoce) { marcadorVoce.remove(); }
      marcadorVoce = L.marker(ponto, { icon: criarPino("EU", "#5de08a", "#0d0a0b", 40), keyboard: false }).addTo(mapa);
    }
    if (distanciaAteVoce !== null) {
      avisar("Você está a " + formatarDistancia(distanciaAteVoce) + " do ponto de embarque, " + EMBARQUE.nome + ".");
    } else {
      avisar("Localização encontrada.");
    }
  }, function () {
    avisar("Não consegui sua localização. O embarque é no " + EMBARQUE.nome + ".");
  });
}

/* ---------- 8) Painel do ônibus ---------- */

let destinoAtual = null;   // destino escolhido
let dados = null;          // dados do ônibus: pontos da rota, tempo, assentos, hotéis
let relogioDoTempo = null;
let relogioDaCamera = null;
let numeroDaEscolha = 0;   // ajuda a ignorar respostas atrasadas de uma escolha antiga
let ultimoMinuto = 0;

// Minutos que faltam (nunca menos de 1, enquanto o ônibus não chegou).
function minutosQueFaltam() {
  return Math.max(1, Math.ceil(dados.segundosAteChegar / 60));
}

function textoAcessibilidade() {
  return "Acessibilidade em " + destinoAtual.nome + ". " + destinoAtual.acessibilidade;
}

// Mostra só uma parte do painel por vez (menos informação ao mesmo tempo): Onibus, Rota, Perto ou Assistente.
function mostrarAba(nome) {
  ["Onibus", "Rota", "Perto", "Assistente"].forEach(function (aba) {
    pegar("#aba" + aba).hidden = aba !== nome;
  });
  document.querySelectorAll(".botao-aba").forEach(function (botao) {
    botao.setAttribute("aria-current", botao.dataset.aba === nome ? "true" : "false");
  });
}

function textoAssento() {
  const estado = dados.assentoPcdOcupado ? "ocupada" : "livre";
  return "Poltrona PCD " + estado + ". " + dados.assentosLivres + " de 12 assentos livres.";
}

function textoRota() {
  return destinoAtual.servico + ": de " + EMBARQUE.nome + " até " + destinoAtual.nome + ", " +
    formatarDistancia(dados.distancia) + ", cerca de " + Math.round(dados.duracao / 60) + " minutos de viagem.";
}

function textoHoteis() {
  if (dados.hoteis.length === 0) {
    return "Não encontrei hotéis próximos nos dados do mapa.";
  }
  const nomes = dados.hoteis.map(function (hotel) {
    return hotel.nome + ", a " + formatarDistancia(hotel.distancia);
  });
  return "Perto de " + destinoAtual.nome + ": " + nomes.join("; ") + ".";
}

// Frase principal: tempo de chegada + assento PCD.
function frasePrincipal() {
  let quando = "chegou ao ponto de embarque";
  if (dados.segundosAteChegar > 0) {
    const minutos = minutosQueFaltam();
    quando = "chegando em " + minutos + (minutos > 1 ? " minutos" : " minuto");
  }
  const assento = dados.assentoPcdOcupado ? "ocupado" : "livre";
  return destinoAtual.servico + " " + quando + " com assento PCD " + assento + ". " +
    dados.assentosLivres + " assentos livres.";
}

// Busca a rota de carro (OSRM). Sem internet, usa uma linha reta.
async function buscarRota(origem, destino) {
  try {
    const endereco = "https://router.project-osrm.org/route/v1/driving/" +
      origem[1] + "," + origem[0] + ";" + destino[1] + "," + destino[0] +
      "?overview=full&geometries=geojson";
    const resposta = await fetch(endereco);
    const json = await resposta.json();
    const rota = json.routes[0];
    const pontos = rota.geometry.coordinates.map(function (par) { return [par[1], par[0]]; });
    return { pontos: pontos, duracao: rota.duration, distancia: rota.distance };
  } catch (erro) {
    const metros = distanciaEntre(origem, destino);
    return { pontos: [origem, destino], duracao: metros / 8, distancia: metros };
  }
}

// Posição do ônibus na rota, de acordo com o tempo que falta.
function posicaoDoOnibus() {
  const parte = dados.segundosAteChegar / dados.duracao;
  const indice = Math.round(parte * (dados.pontos.length - 1));
  return dados.pontos[indice];
}

// Atualiza os textos e cores do painel.
function desenharPainel() {
  const cor = dados.assentoPcdOcupado ? "ocupado" : "";
  pegar("#alerta").className = "alerta " + cor;
  pegar("#selo").className = "selo " + cor;
  pegar("#selo").textContent = dados.assentoPcdOcupado ? "✕ OCUPADA" : "✓ LIVRE";
  pegar("#tempo").textContent = dados.segundosAteChegar > 0 ? minutosQueFaltam() + " min" : "Chegou";
  const feito = 1 - dados.segundosAteChegar / dados.segundosIniciais;   // quanto do caminho o ônibus já andou
  pegar("#barra").style.width = Math.round(Math.min(1, Math.max(0, feito)) * 100) + "%";
  pegar("#textoCamera").textContent = "Poltrona PCD " + (dados.assentoPcdOcupado ? "ocupada" : "livre") + ". " +
    dados.assentosLivres + " de 12 assentos livres. Atualizado às " + new Date().toLocaleTimeString("pt-BR") + ".";
}

// Anuncia o status: escreve no alerta (leitor de tela), fala e vibra.
function anunciarStatus(prefixo) {
  desenharPainel();
  const frase = (prefixo ? prefixo + " " : "") + frasePrincipal();
  const alerta = pegar("#alerta");
  alerta.textContent = "";
  setTimeout(function () { alerta.textContent = frase; }, 40);   // texto novo faz o leitor de tela falar
  falar(frase);
  if (dados.segundosAteChegar === 0) {
    vibrar([400, 150, 400]);
  } else if (prefixo) {
    vibrar([200, 100, 200]);
  } else {
    vibrar(80);
  }
}

// Escolhe um destino (pela voz, pela lista ou pelo mapa).
async function escolherDestino(indice) {
  clearInterval(relogioDoTempo);
  clearInterval(relogioDaCamera);
  numeroDaEscolha = numeroDaEscolha + 1;
  const minhaEscolha = numeroDaEscolha;
  destinoAtual = DESTINOS[indice];

  pegar("#tituloPainel").textContent = destinoAtual.servico + " · " + destinoAtual.nome;
  pegar("#textoRota").textContent = "Calculando a rota…";
  pegar("#listaHoteis").replaceChildren();
  mostrar(pegar("#painel"), true);
  if (mapa) {
    camada.clearLayers();
  }

  const rota = await buscarRota(EMBARQUE.posicao, destinoAtual.posicao);
  if (minhaEscolha !== numeroDaEscolha) {
    return;   // a pessoa já escolheu outro destino
  }

  dados = {
    pontos: rota.pontos,
    duracao: rota.duracao,
    distancia: rota.distancia,
    segundosAteChegar: Math.min(rota.duracao, 240 + sortear(120)),   // simulado: ônibus a 4 a 6 minutos
    assentoPcdOcupado: false,                                        // simulado: câmera com IA
    assentosLivres: 2 + sortear(8),                                  // simulado
    hoteis: []
  };
  dados.segundosIniciais = dados.segundosAteChegar;
  ultimoMinuto = minutosQueFaltam();

  // Desenha no mapa: rota, destino e ônibus.
  if (mapa) {
    L.polyline(dados.pontos, { color: corDaRota(), weight: 6 }).addTo(camada);
    L.marker(destinoAtual.posicao, { icon: criarPino(destinoAtual.sigla, "#8b1f2f", "#ffffff", 36), keyboard: false }).addTo(camada);
    marcadorOnibus = L.marker(posicaoDoOnibus(), { icon: criarPino(destinoAtual.sigla, "#ffffff", "#0d0a0b", 46), keyboard: false }).addTo(camada);
    mapa.fitBounds(L.polyline(dados.pontos).getBounds(), { padding: [30, 30] });
  }

  pegar("#textoRota").textContent = textoRota();
  pegar("#textoDestino").textContent = destinoAtual.descricao;
  pegar("#textoAcessibilidade").textContent = destinoAtual.acessibilidade;
  pegar("#textoConfirmar").textContent = "Ainda a confirmar: " + destinoAtual.aConfirmar.join("; ") + ".";
  mostrarAba("Onibus");
  pegar("#linkMaps").href = "https://www.google.com/maps/dir/?api=1&destination=" +
    EMBARQUE.posicao[0] + "," + EMBARQUE.posicao[1] + "&travelmode=walking";

  anunciarStatus("Você escolheu " + destinoAtual.nome + ".");
  pegar("#tituloPainel").focus();

  // Mantém a tela acesa durante o acompanhamento (se o navegador permitir).
  if (navigator.wakeLock) {
    navigator.wakeLock.request("screen").catch(function () { });
  }

  relogioDoTempo = setInterval(passarTempo, 1000);
  relogioDaCamera = setInterval(lerCamera, 12000);
  buscarHoteis(minhaEscolha);
}

// A cada segundo: o ônibus anda e o tempo diminui.
function passarTempo() {
  dados.segundosAteChegar = Math.max(0, dados.segundosAteChegar - VELOCIDADE_TESTE);
  if (marcadorOnibus) {
    marcadorOnibus.setLatLng(posicaoDoOnibus());
  }

  if (dados.segundosAteChegar === 0) {
    clearInterval(relogioDoTempo);
    anunciarStatus("");
  } else if (minutosQueFaltam() !== ultimoMinuto) {
    ultimoMinuto = minutosQueFaltam();
    anunciarStatus("");
  } else {
    desenharPainel();
  }
}

// A cada 12 segundos: nova "leitura" da câmera (simulada).
function lerCamera() {
  const estavaOcupado = dados.assentoPcdOcupado;
  if (Math.random() < 0.3) {
    dados.assentoPcdOcupado = !dados.assentoPcdOcupado;
  }
  dados.assentosLivres = Math.min(12, Math.max(0, dados.assentosLivres + sortear(3) - 1));
  if (estavaOcupado !== dados.assentoPcdOcupado) {
    anunciarStatus("Atenção.");     // o assento PCD mudou
  } else {
    desenharPainel();
  }
}

// Procura hotéis até 5 km do destino (dados do OpenStreetMap).
async function buscarHoteis(minhaEscolha) {
  try {
    const consulta = '[out:json][timeout:15];nwr["tourism"~"hotel|hostel|guest_house|motel|apartment"]["name"]' +
      "(around:5000," + destinoAtual.posicao[0] + "," + destinoAtual.posicao[1] + ");out center 40;";
    const resposta = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: new URLSearchParams({ data: consulta })
    });
    const json = await resposta.json();
    if (minhaEscolha !== numeroDaEscolha) { return; }

    const lista = [];
    for (const item of json.elements) {
      const ponto = item.center ? [item.center.lat, item.center.lon] : [item.lat, item.lon];
      if (ponto[0] && item.tags && item.tags.name) {
        lista.push({ nome: item.tags.name, posicao: ponto, distancia: distanciaEntre(destinoAtual.posicao, ponto) });
      }
    }
    lista.sort(function (a, b) { return a.distancia - b.distancia; });
    dados.hoteis = lista.slice(0, 4);
  } catch (erro) {
    if (minhaEscolha !== numeroDaEscolha) { return; }
    dados.hoteis = [];
  }

  // Mostra na lista e no mapa.
  const itens = dados.hoteis.map(function (hotel) {
    const item = document.createElement("li");
    item.textContent = hotel.nome + " · " + formatarDistancia(hotel.distancia);
    return item;
  });
  if (itens.length === 0) {
    const vazio = document.createElement("li");
    vazio.textContent = "Sem hotéis nos dados do mapa nesta região.";
    itens.push(vazio);
  }
  pegar("#listaHoteis").replaceChildren(...itens);
  dados.hoteis.forEach(function (hotel) {
    if (!mapa) { return; }
    L.marker(hotel.posicao, { icon: criarPino("H", "#ffffff", "#0d0a0b", 30), keyboard: false }).addTo(camada);
  });
}

/* ---------- 9) Ligações dos botões e início ---------- */

// Botões de destino da tela inicial (alternativa sem voz) e cartões da lista.
DESTINOS.forEach(function (destino, indice) {
  // Bolha do destino (tela inicial): foto transparente + nome.
  const bolha = document.createElement("button");
  bolha.className = "bolha b" + (indice + 1);
  bolha.setAttribute("aria-label", "Escolher " + destino.nome);
  bolha.innerHTML = '<span class="foto" aria-hidden="true"></span><span class="nome"></span>';
  bolha.querySelector(".foto").style.backgroundImage = "url(" + destino.foto + ")";
  bolha.querySelector(".nome").textContent = destino.nome;
  bolha.onclick = function () { responder(destino.nome); };
  pegar("#bolhas").appendChild(bolha);

  const cartao = document.createElement("li");
  cartao.className = "cartao";
  cartao.innerHTML = '<h3 class="font-serif text-3xl"></h3><p class="pilula"></p><button class="botao botao-forte">Acompanhar o ônibus</button>';
  cartao.querySelector("h3").textContent = destino.nome;
  cartao.querySelector("p").textContent = destino.servico;
  const acompanhar = cartao.querySelector("button");
  acompanhar.setAttribute("aria-label", "Acompanhar o " + destino.servico + " até " + destino.nome);
  acompanhar.onclick = function () { escolherDestino(indice); };
  pegar("#cartoes").appendChild(cartao);
});

pegar("#botaoMicrofone").onclick = function () { tocarMicrofone(pegar("#botaoMicrofone")); };
pegar("#botaoPerguntar").onclick = function () { tocarMicrofone(pegar("#botaoPerguntar")); };
document.querySelectorAll(".botao-aba").forEach(function (botao) {
  botao.onclick = function () {
    if (!dados) { return; }
    mostrarAba(botao.dataset.aba);
    const falas = { Onibus: frasePrincipal, Rota: textoRota, Perto: textoHoteis, Assistente: function () { return "Pergunte por voz ou digite. Por exemplo: tem assento livre?"; } };
    avisar(falas[botao.dataset.aba]());
  };
});
pegar("#botaoVoltar").onclick = function () { voltar(); };
pegar("#botaoRepetir").onclick = function () { repetirUltima(); };
pegar("#botaoVoz").onclick = function () { definirVoz(!vozLigada, true); };
pegar("#botaoTema").onclick = function () { aplicarTema(!document.body.classList.contains("claro"), true); };
// Tema e voz iniciais: o que a pessoa escolheu antes. Se nunca escolheu, o tema segue o do aparelho.
let temaSalvo = null;
let vozSalva = null;
try { temaSalvo = localStorage.getItem("mobintecTema"); vozSalva = localStorage.getItem("mobintecVoz"); velocidadeVoz = Number(localStorage.getItem("mobintecVelocidade")) || 1; } catch (e) { }
aplicarTema(temaSalvo ? temaSalvo === "claro" : true, false);   // primeira visita: tema claro (design system do projeto)
definirVoz(vozSalva !== "desligada", false);
pegar("#botaoAjuda").onclick = function () { avisar(TEXTO_AJUDA); };
pegar("#botaoOuvirStatus").onclick = function () { if (dados) { anunciarStatus(""); } };
pegar("#botaoOuvirHoteis").onclick = function () { if (dados) { avisar(textoHoteis()); } };

// Formulário de texto (alternativa à voz).
pegar("#formulario").onsubmit = function (evento) {
  evento.preventDefault();
  responder(pegar("#campoTexto").value);
};

// Na tela inicial, tocar em qualquer lugar liga o microfone (só até o primeiro destino ser entendido).
let tocarEmQualquerLugar = true;
document.addEventListener("click", function (evento) {
  const naTelaInicial = !pegar("#telaInicio").hidden;
  const tocouEmControle = evento.target.closest("button, input, a");
  if (tocarEmQualquerLugar && naTelaInicial && !tocouEmControle) {
    tocarMicrofone(pegar("#botaoMicrofone"));
  }
});

// Avisos para quem abriu o site em um lugar onde a voz não funciona.
const navegador = navigator.userAgent;
if (/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|TikTok|; wv\)/i.test(navegador)) {
  mostrar(pegar("#aviso"), true);
  pegar("#aviso").textContent = "Você abriu o site dentro de outro aplicativo (como Instagram ou WhatsApp), onde a voz não funciona. " +
    "Toque nos três pontinhos e escolha “Abrir no navegador”.";
} else if (!ReconhecimentoDoNavegador) {
  mostrar(pegar("#aviso"), true);
  pegar("#aviso").textContent = "Este navegador não tem voz própria. O site vai usar a voz dele, que baixa cerca de 40 MB na primeira vez.";
}

// O botão "voltar" do aparelho leva ao início (só se a lista estiver aberta).
window.addEventListener("popstate", function () {
  if (!pegar("#telaLista").hidden) { abrirTela("inicio"); }
});

// Link "Ir para o conteúdo": foca o conteúdo sem mudar o endereço da página.
pegar(".pular").onclick = function (evento) {
  evento.preventDefault();
  pegar("#principal").focus();
};

// Começa na tela inicial e fala as boas-vindas (o navegador pode bloquear a fala até o primeiro toque).
abrirTela("inicio", true);
window.addEventListener("load", function () { falar(BOAS_VINDAS); });