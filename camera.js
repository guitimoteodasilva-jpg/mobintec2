/*
  MOBINTEC — integração de câmera.

  Carregar depois de script.js, sem type="module".

  Não contém chaves.
  Não vincula uma câmera de demonstração aos destinos turísticos.
  Não confirma disponibilidade PCD.
*/

(function () {
  "use strict";

  const BACKEND = "https://mobintec-backend.onrender.com";
  const CAMERA_ID = "onibus-demo";
  const VALIDADE_MS = 15000;

  let modo = "celular";
  let fluxo = null;
  let controle = null;
  let consultaAgendada = null;
  let ocupado = false;
  let abrindo = false;
  let sessao = 0;
  let leitura = null;
  let ultimaFalaCamera = "";

  if (document.getElementById("cameraMobintec")) {
    return;
  }

  /* ---------- Interface ---------- */

  const painel = document.createElement("section");

  painel.id = "cameraMobintec";
  painel.setAttribute("aria-labelledby", "tituloCameraMobintec");

  painel.innerHTML = `
    <h2 id="tituloCameraMobintec">Análise de assentos por câmera</h2>

    <p>
      Demonstração independente do destino escolhido.
      Esta câmera não está cadastrada em um ônibus turístico real.
    </p>

    <label for="fonteCameraMobintec">Escolha a câmera</label>

    <select id="fonteCameraMobintec">
      <option value="celular">Câmera deste celular</option>
      <option value="fixa">ESP32-CAM de demonstração</option>
    </select>

    <div id="controlesCelularMobintec">
      <p>
        <button type="button" id="abrirCameraMobintec" class="botao">
          Abrir câmera traseira
        </button>

        <button type="button" id="analisarCameraMobintec"
          class="botao" disabled>
          Analisar uma foto
        </button>
      </p>

      <video id="videoCameraMobintec"
        autoplay muted playsinline hidden
        aria-label="Imagem da câmera deste aparelho">
      </video>

      <p>
        Cada toque em Analisar uma foto envia uma imagem
        ao backend e ao Roboflow. Isso consome créditos.
        Não há envio automático de fotos.
      </p>
    </div>

    <div id="controlesFixaMobintec" hidden>
      <p>
        Consulta a última análise enviada pela ponte da câmera
        onibus-demo. Não conecta nem programa a ESP32-CAM.
      </p>

      <button type="button" id="consultarFixaMobintec" class="botao">
        Iniciar consulta da câmera fixa
      </button>
    </div>

    <p>
      <button type="button" id="ouvirCameraMobintec" class="botao">
        Ouvir última leitura
      </button>

      <button type="button" id="pararCameraMobintec" class="botao">
        Parar câmera e consultas
      </button>
    </p>

    <p id="estadoCameraMobintec" role="status" aria-live="polite">
      Sem leitura. Abra a câmera para começar.
    </p>

    <p>
      A identificação é uma estimativa.
      Não confirma lugar livre nem disponibilidade PCD.
      Esquerda e direita referem-se à imagem.
      Não use este protótipo para se deslocar sem ajuda.
    </p>
  `;

  painel.style.cssText =
    "margin:24px auto;padding:20px;max-width:780px;" +
    "border:2px solid currentColor;border-radius:16px;";

  const principal = document.querySelector("#principal");
  (principal || document.body).appendChild(painel);

  const el = id => document.getElementById(id);
  const video = el("videoCameraMobintec");
  const estado = el("estadoCameraMobintec");
  const botaoAbrir = el("abrirCameraMobintec");
  const botaoAnalisar = el("analisarCameraMobintec");
  const botaoConsultar = el("consultarFixaMobintec");

  video.style.cssText =
    "display:block;width:100%;max-height:380px;" +
    "object-fit:contain;background:#111;border-radius:12px;" +
    "transform:none;";

  // Garante que o atributo hidden não seja vencido pelo estilo.
  video.style.display = "none";

  function escrever(texto) {
    if (estado.textContent !== texto) {
      estado.textContent = texto;
    }
  }

  function leituraRecente() {
    return leitura && performance.now() < leitura.expira;
  }

  function textoDaCamera() {
    if (leituraRecente()) {
      const origem = leitura.fonte === "celular"
        ? "Análise da câmera deste celular."
        : "Análise da câmera fixa de demonstração.";

      return (
        origem + " " + leitura.mensagem +
        " A disponibilidade PCD não foi confirmada." +
        " Esta câmera não está vinculada ao destino escolhido."
      );
    }

    return (
      "Sem leitura atual confirmada de assentos. " +
      "A disponibilidade da poltrona PCD não foi verificada."
    );
  }

  function ouvirLeitura() {
    ultimaFalaCamera = textoDaCamera();
    avisar(ultimaFalaCamera);
  }

  function atualizarPainelOnibus() {
    if (dados) {
      desenharPainel();
    }
  }

  function invalidarLeitura() {
    leitura = null;
    atualizarPainelOnibus();
  }

  function parar(mostrarMensagem = true) {
    sessao += 1;

    clearTimeout(consultaAgendada);
    consultaAgendada = null;

    if (controle) {
      controle.abort();
      controle = null;
    }

    if (fluxo) {
      fluxo.getTracks().forEach(faixa => faixa.stop());
      fluxo = null;
    }

    video.srcObject = null;
    video.hidden = true;
    video.style.display = "none";

    ocupado = false;
    abrindo = false;

    botaoAbrir.disabled = false;
    botaoAnalisar.disabled = true;
    botaoConsultar.disabled = false;

    invalidarLeitura();

    // Não mantém uma fala de resultado antigo em execução.
    if (
      ultimaFalaCamera &&
      ultimaFala === ultimaFalaCamera &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    if (mostrarMensagem) {
      escrever("Câmera e consultas paradas. Sem leitura atual.");
    }
  }

  /* ---------- Câmera do celular ---------- */

  async function abrirCamera() {
    if (abrindo || modo !== "celular") return;

    parar(false);

    const minhaSessao = sessao;
    abrindo = true;
    botaoAbrir.disabled = true;

    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      abrindo = false;
      botaoAbrir.disabled = false;

      escrever(
        "Abra o site por HTTPS no Chrome ou Safari. " +
        "Este navegador não disponibilizou acesso à câmera."
      );
      return;
    }

    escrever("Solicitando permissão da câmera…");

    try {
      const novoFluxo = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 960 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (minhaSessao !== sessao || document.hidden) {
        novoFluxo.getTracks().forEach(faixa => faixa.stop());
        return;
      }

      fluxo = novoFluxo;
      video.srcObject = fluxo;
      video.hidden = false;
      video.style.display = "block";

      await video.play();

      if (minhaSessao !== sessao) return;

      botaoAnalisar.disabled = false;

      escrever(
        "Câmera aberta. Aponte para os assentos e toque " +
        "em Analisar uma foto. A câmera traseira foi solicitada; " +
        "o navegador escolhe o dispositivo disponível."
      );
    } catch (erro) {
      if (minhaSessao !== sessao) return;

      parar(false);

      escrever(
        erro.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere a câmera nas configurações do navegador."
          : "Não consegui abrir a câmera. Feche outros aplicativos que usam a câmera e tente novamente."
      );
    } finally {
      if (minhaSessao === sessao) {
        abrindo = false;
        botaoAbrir.disabled = false;
      }
    }
  }

  async function capturarFoto() {
    if (
      !fluxo ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      throw new Error("A câmera ainda não está pronta.");
    }

    const escala = Math.min(
      1,
      960 / Math.max(video.videoWidth, video.videoHeight)
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(
      1, Math.round(video.videoWidth * escala)
    );

    canvas.height = Math.max(
      1, Math.round(video.videoHeight * escala)
    );

    const contexto = canvas.getContext("2d");

    if (!contexto) {
      throw new Error("Não consegui preparar a captura.");
    }

    contexto.drawImage(
      video, 0, 0, canvas.width, canvas.height
    );

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });

    if (!blob) {
      throw new Error("Não consegui capturar a foto.");
    }

    return blob;
  }

  async function lerResposta(resposta) {
    let json;

    try {
      json = await resposta.json();
    } catch {
      throw new Error(
        "O backend não respondeu corretamente. " +
        "Pode estar iniciando ou indisponível."
      );
    }

    if (!resposta.ok) {
      const detalhe = typeof json.detail === "string"
        ? json.detail
        : "Falha no backend.";

      throw new Error(
        detalhe + " Código HTTP " + resposta.status + "."
      );
    }

    return json;
  }

  function aceitarLeitura(json, restante, fonte) {
    if (
      json.estado !== "recente" ||
      typeof json.mensagem !== "string" ||
      !json.mensagem.trim() ||
      !Number.isFinite(restante) ||
      restante <= 0
    ) {
      invalidarLeitura();

      escrever(
        json.estado === "expirado"
          ? "A última leitura expirou. Aguarde uma captura nova."
          : "Sem leitura recente disponível."
      );

      return false;
    }

    leitura = {
      fonte,
      mensagem: json.mensagem,
      expira: performance.now() + Math.min(
        VALIDADE_MS, restante
      )
    };

    escrever(textoDaCamera());
    atualizarPainelOnibus();
    return true;
  }

  async function analisarFoto() {
    if (
      ocupado ||
      !fluxo ||
      modo !== "celular" ||
      document.hidden
    ) {
      return;
    }

    ocupado = true;
    botaoAnalisar.disabled = true;
    invalidarLeitura();

    const minhaSessao = sessao;
    const abortador = new AbortController();
    controle = abortador;

    const prazo = setTimeout(
      () => abortador.abort(), 45000
    );

    try {
      const capturadoEm = new Date().toISOString();
      const instante = performance.now();
      const blob = await capturarFoto();

      if (minhaSessao !== sessao) return;

      const requisicaoId = window.crypto?.randomUUID?.() ||
        Date.now() + "-" + Math.random().toString(36).slice(2);

      const formulario = new FormData();

      formulario.append("image", blob, "captura.jpg");
      formulario.append("capturadoEm", capturadoEm);
      formulario.append("requisicaoId", requisicaoId);

      escrever(
        "Analisando a foto. Aguarde. " +
        "Ainda não há disponibilidade confirmada."
      );

      const resposta = await fetch(
        BACKEND + "/api/analisar",
        {
          method: "POST",
          body: formulario,
          signal: abortador.signal,
          cache: "no-store"
        }
      );

      const json = await lerResposta(resposta);

      if (minhaSessao !== sessao) return;

      if (
        json.capturadoEm !== capturadoEm ||
        json.requisicaoId !== requisicaoId
      ) {
        throw new Error(
          "A resposta não corresponde à foto enviada."
        );
      }

      const idade = performance.now() - instante;
      const restanteServidor =
        Number(json.validaPorSegundos) * 1000;

      const restante = Math.min(
        VALIDADE_MS - idade,
        restanteServidor
      );

      if (restante <= 0) {
        escrever(
          "A resposta chegou tarde demais e foi descartada. " +
          "Capture uma foto nova."
        );
        return;
      }

      if (aceitarLeitura(json, restante, "celular")) {
        ouvirLeitura();
      }
    } catch (erro) {
      if (minhaSessao !== sessao) return;

      invalidarLeitura();

      escrever(
        erro.name === "AbortError"
          ? "O backend demorou para responder. O Render pode estar iniciando. Tente novamente."
          : erro instanceof TypeError
            ? "Não consegui acessar o backend. Confira a publicação e a configuração ALLOWED_ORIGIN no Render."
            : erro.message
      );
    } finally {
      clearTimeout(prazo);

      if (controle === abortador) {
        controle = null;
      }

      if (minhaSessao === sessao) {
        ocupado = false;
        botaoAnalisar.disabled = !fluxo;
      }
    }
  }

  /* ---------- Câmera fixa ---------- */

  async function consultarFixa(minhaSessao) {
    if (
      minhaSessao !== sessao ||
      modo !== "fixa" ||
      document.hidden
    ) {
      return;
    }

    const inicio = performance.now();
    const abortador = new AbortController();
    controle = abortador;

    const prazo = setTimeout(
      () => abortador.abort(), 12000
    );

    let continuar = true;

    try {
      const resposta = await fetch(
        BACKEND + "/api/cameras/" + CAMERA_ID + "/resultado",
        {
          cache: "no-store",
          signal: abortador.signal
        }
      );

      const json = await lerResposta(resposta);

      if (minhaSessao !== sessao) return;

      // Conservador: desconta todo o tempo da requisição.
      const restante =
        Number(json.validaPorSegundos) * 1000 -
        (performance.now() - inicio);

      aceitarLeitura(json, restante, "fixa");
    } catch (erro) {
      if (minhaSessao !== sessao) return;

      continuar = false;
      invalidarLeitura();
      botaoConsultar.disabled = false;

      escrever(
        "Consulta interrompida. " +
        (erro.name === "AbortError"
          ? "O backend demorou para responder."
          : erro.message) +
        " Confira o backend e tente iniciar a consulta novamente."
      );
    } finally {
      clearTimeout(prazo);

      if (controle === abortador) {
        controle = null;
      }

      if (
        continuar &&
        minhaSessao === sessao &&
        modo === "fixa"
      ) {
        consultaAgendada = setTimeout(
          () => consultarFixa(minhaSessao),
          3000
        );
      }
    }
  }

  function iniciarConsultaFixa() {
    parar(false);
    modo = "fixa";
    botaoConsultar.disabled = true;

    escrever("Consultando a câmera fixa de demonstração…");
    consultarFixa(sessao);
  }

  /* ---------- Eventos ---------- */

  botaoAbrir.onclick = abrirCamera;
 botaoAnalisar.onclick = async function () {
  try {
    escrever("Botão acionado. Verificando a câmera…");

    if (modo !== "celular") {
      escrever(
        "Selecione Câmera deste celular antes de analisar."
      );
      return;
    }

    if (!fluxo || !fluxo.active) {
      escrever(
        "A câmera não está ativa. Toque em Abrir câmera traseira."
      );
      return;
    }

    if (ocupado) {
      escrever(
        "Já existe uma análise em andamento. Aguarde. " +
        "Se não terminar, toque em Parar câmera e consultas " +
        "e abra a câmera novamente."
      );
      return;
    }

    if (
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      escrever(
        "A câmera abriu, mas a imagem ainda não está pronta. " +
        "Aguarde alguns segundos e tente novamente."
      );
      return;
    }

    await analisarFoto();
  } catch (erro) {
    ocupado = false;
    botaoAnalisar.disabled = !fluxo;

    escrever(
      "Não consegui iniciar a análise: " +
      String(erro.message || erro)
    );
  }
};

  botaoConsultar.onclick = iniciarConsultaFixa;

  el("ouvirCameraMobintec").onclick = ouvirLeitura;

  el("pararCameraMobintec").onclick = function () {
    parar();
  };

  el("fonteCameraMobintec").onchange = function () {
    const escolhido = this.value;

    parar(false);
    modo = escolhido;

    el("controlesCelularMobintec").hidden =
      modo !== "celular";

    el("controlesFixaMobintec").hidden =
      modo !== "fixa";

    escrever(
      modo === "celular"
        ? "Abra a câmera e analise uma foto."
        : "Toque em Iniciar consulta. A ESP32-CAM precisa estar programada e a ponte precisa estar enviando imagens."
    );
  };

  document.addEventListener(
    "visibilitychange",
    function () {
      if (document.hidden) parar();
    }
  );

  window.addEventListener("pagehide", function () {
    parar(false);
  });

  setInterval(function () {
    if (leitura && !leituraRecente()) {
      invalidarLeitura();

      if (
        ultimaFala === ultimaFalaCamera &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }

      escrever(
        "A última leitura expirou. " +
        "Não há disponibilidade atual confirmada."
      );
    }
  }, 1000);

  /* ---------- Adaptação do script atual ---------- */

  // Substitui as respostas de assentos, sem alterar mapa,
  // localização, restaurantes, atrações ou hotéis.
  textoAssento = function () {
    return textoDaCamera();
  };

  frasePrincipal = function () {
    if (!destinoAtual || !dados) {
      return "Escolha um destino para acompanhar a demonstração.";
    }

    const chegada = dados.segundosAteChegar > 0
      ? "Na simulação, o " + destinoAtual.servico +
        " chega em " + minutosQueFaltam() + " minutos."
      : "Na simulação, o " + destinoAtual.servico +
        " chegou ao ponto de embarque.";

    return (
      chegada +
      " A posição do ônibus também é simulada. " +
      "Não há câmera vinculada a esse destino. " +
      "A análise independente fica no painel de câmera."
    );
  };

  desenharPainel = function () {
    if (!dados) return;

    // Os campos antigos não são usados como leitura real.
    delete dados.assentoPcdOcupado;
    delete dados.assentosLivres;

    pegar("#alerta").className = "alerta";
    pegar("#selo").className = "selo";
    pegar("#selo").textContent = "NÃO CONFIRMADO";

    pegar("#tempo").textContent =
      dados.segundosAteChegar > 0
        ? minutosQueFaltam() + " min · simulação"
        : "Chegou · simulação";

    const feito = dados.segundosIniciais > 0
      ? 1 - dados.segundosAteChegar / dados.segundosIniciais
      : 1;

    pegar("#barra").style.width =
      Math.round(
        Math.min(1, Math.max(0, feito)) * 100
      ) + "%";

    const mensagem =
      "Este destino não tem câmera vinculada. " +
      "Use o painel de câmera para uma análise independente. " +
      "Disponibilidade PCD não confirmada.";

    if (pegar("#textoCamera").textContent !== mensagem) {
      pegar("#textoCamera").textContent = mensagem;
    }
  };

  // Desativa a antiga leitura aleatória.
  lerCamera = function () {};

  // Remove o temporizador de sorteio depois da escolha.
  const escolherOriginal = escolherDestino;

  escolherDestino = async function (indice) {
    const promessa = escolherOriginal(indice);
    const escolha = numeroDaEscolha;

    await promessa;

    if (escolha === numeroDaEscolha) {
      clearInterval(relogioDaCamera);
      relogioDaCamera = null;

      if (dados) {
        delete dados.assentoPcdOcupado;
        delete dados.assentosLivres;
        desenharPainel();
      }
    }
  };

  // Intercepta perguntas de assentos antes das buscas
  // genéricas de lugares próximos.
  const responderOriginal = responder;

  responder = function (texto) {
    const limpo = semAcento(String(texto || ""));

    if (
      /\b(assentos?|poltronas?|lugares?|livres?|pcd)\b/.test(limpo) &&
      !/\b(restaurantes?|hoteis|hotel|pousadas?|turisticos?)\b/.test(limpo)
    ) {
      ouvirLeitura();
      return;
    }

    responderOriginal(texto);
  };

  const repetirOriginal = repetirUltima;

  repetirUltima = function () {
    if (
      ultimaFalaCamera &&
      ultimaFala === ultimaFalaCamera
    ) {
      ouvirLeitura();
    } else {
      repetirOriginal();
    }
  };

  // Selecionar ou tocar no painel da câmera não inicia
  // o microfone da tela inicial.
  painel.addEventListener("click", function (evento) {
    evento.stopPropagation();
  });

  // Mantém avisos de geolocalização aproximados.
  // GPS não confirma que a pessoa chegou ao ponto exato.
  const posicaoOriginal = aoReceberPosicao;

  aoReceberPosicao = function (posicao) {
    const avisoOriginal = avisar;

    avisar = function (texto) {
      if (texto === "Você chegou ao ponto de embarque.") {
        texto =
          "Sua localização indica proximidade do ponto de embarque. " +
          "O GPS é aproximado; confirme o local com ajuda.";
      }

      avisoOriginal(texto);
    };

    try {
      posicaoOriginal(posicao);
    } finally {
      avisar = avisoOriginal;
    }
  };
})();

