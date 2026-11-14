/*
 * MOBINTEC — integração de câmera, versão 5.
 * Carregar depois de script.js, com defer.
 * Não traduzir palavras técnicas deste arquivo.
 */

(function () {
  "use strict";

  const BACKEND = "https://onrender.com";
  const CAMERA_ID = "onibus-demo";
  const VALIDADE_MS = 15000;

  let modo = "celular";
  let fluxo = null;
  let controle = null;
  let temporizador = null;
  let sessao = 0;
  let ocupado = false;
  let abrindo = false;
  let leitura = null;
  let ultimaMensagemCamera = "";
  let automatico = false;
  let temporizadorAutomatico = null;
  let cicloAutomatico = 0;

  if (document.getElementById("cameraMobintec")) {
    return;
  }

  const painel = document.createElement("section");

  painel.id = "cameraMobintec";
  painel.setAttribute("aria-labelledby", "tituloCameraMobintec");

  painel.className = "painel";
  painel.style.cssText =
    "margin:24px auto;padding:20px;max-width:780px;" +
    "border:2px solid currentColor;border-radius:16px;";

  painel.innerHTML =
    '<h2 id="tituloCameraMobintec">Análise de assentos por câmera</h2>' +
    '<div role="group" aria-label="Fonte da imagem" class="grupo-fontes">' +
      '<button type="button" class="botao" data-fonte="celular" aria-pressed="true">' +
        'Câmera deste celular' +
      '</button>' +
      '<button type="button" class="botao" data-fonte="fixa" aria-pressed="false">' +
        'Câmera do ônibus (ESP32)' +
      '</button>' +
    '</div>' +
    '<div class="subcaixa">' +
      '<video id="videoCameraMobintec" autoplay muted playsinline hidden aria-label="Prévia da câmera deste aparelho"></video>' +
      '<p id="avisoFixaMobintec" hidden style="margin: 0;">' +
        'Consulta a última análise da câmera <strong>onibus-demo</strong>. A placa e a ponte precisam estar configuradas.' +
      '</p>' +
      '<p id="estadoCameraMobintec" role="status" aria-live="polite" style="margin: 0; font-weight: 600;">' +
        'Toque no botão abaixo para começar a leitura.' +
      '</p>' +
    '</div>' +
    '<button type="button" id="iniciarLeituraMobintec" class="botao botao-forte" style="width: 100%;">' +
      'Começar leitura dos assentos' +
    '</button>' +
    '<div class="acoes-secundarias">' +
      '<button type="button" id="ouvirCameraMobintec" class="botao">' +
        'Ouvir última leitura' +
      '</button>' +
      '<button type="button" id="pararCameraMobintec" class="botao" hidden>' +
        'Parar leitura' +
      '</button>' +
    '</div>' +
    '<p style="font-size: .9rem; color: var(--on-dark-soft); margin: 0;">' +
      'O resultado é uma estimativa, não uma confirmação de lugar livre.' +
    '</p>';

  const principal = document.querySelector("#principal");
  (principal || document.body).appendChild(painel);

  const el = function (id) {
    return document.getElementById(id);
  };

  const video = el("videoCameraMobintec");
  const estado = el("estadoCameraMobintec");
  const avisoFixa = el("avisoFixaMobintec");
  const iniciarBotao = el("iniciarLeituraMobintec");
  const pararBotao = el("pararCameraMobintec");
  const botoesFonte = painel.querySelectorAll("[data-fonte]");

  video.style.cssText =
    "width:100%;max-height:380px;object-fit:contain;" +
    "background:#111;border-radius:12px;transform:none;";

  function escrever(texto) {
    if (estado.textContent !== texto) {
      estado.textContent = texto;
    }
  }

  function recente() {
    return leitura !== null && performance.now() < leitura.expira;
  }

  function textoAtual() {
    if (!recente()) {
      return (
        "Sem leitura atual confirmada de assentos. " +
        "A disponibilidade PCD não foi verificada."
      );
    }

    const origem = leitura.fonte === "celular"
      ? "Análise da câmera deste celular."
      : "Análise da câmera fixa de demonstração.";

    return (
      origem + " " + leitura.mensagem +
      " A disponibilidade PCD não foi verificada." +
      " Esta câmera não está vinculada ao destino escolhido."
    );
  }

  function avisarCamera(texto) {
    ultimaMensagemCamera = texto;

    if (typeof avisar === "function") {
      avisar(texto);
    } else {
      escrever(texto);
    }
  }

  function ouvirLeitura() {
    avisarCamera(textoAtual());
  }

  function limparLeitura() {
    leitura = null;
  }

  function parar(mostrarMensagem = true) {
    automatico = false;
    cicloAutomatico += 1;

    clearTimeout(temporizadorAutomatico);
    temporizadorAutomatico = null;

    sessao += 1;

    clearTimeout(temporizador);
    temporizador = null;

    if (controle) {
      controle.abort();
      controle = null;
    }

    if (fluxo) {
      fluxo.getTracks().forEach(function (faixa) {
        faixa.stop();
      });
      fluxo = null;
    }

    video.srcObject = null;
    video.hidden = true;

    ocupado = false;
    abrindo = false;

    iniciarBotao.disabled = false;
    iniciarBotao.hidden = false;
    pararBotao.hidden = true;

    limparLeitura();

    if (
      typeof ultimaFala !== "undefined" &&
      ultimaMensagemCamera &&
      ultimaFala === ultimaMensagemCamera &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    if (mostrarMensagem) {
      escrever("Câmera e consultas paradas. Sem leitura atual.");
    }
  }

    async function abrirCamera() {
    function iniciarAutomatico() {
      clearTimeout(temporizadorAutomatico);

      automatico = true;
      cicloAutomatico += 1;

      const meuCiclo = cicloAutomatico;

      async function executarCiclo() {
        if (
          !automatico ||
          meuCiclo !== cicloAutomatico ||
          modo !== "celular" ||
          !fluxo ||
          !fluxo.active ||
          document.hidden
        ) {
          return;
        }

        if (
          ocupado ||
          video.readyState < 2 ||
          !video.videoWidth ||
          !video.videoHeight
        ) {
          temporizadorAutomatico = setTimeout(executarCiclo, 1000);
          return;
        }

        await analisarFoto();

        if (!automatico || meuCiclo !== cicloAutomatico) {
          return;
        }

        if (!recente()) {
          automatico = false;
          iniciarBotao.disabled = false;
          iniciarBotao.hidden = false;

          escrever(
            estado.textContent +
            " O modo automático foi pausado. " +
            "Para tentar novamente, toque em Começar leitura dos assentos."
          );
          return;
        }

        temporizadorAutomatico = setTimeout(executarCiclo, 8000);
      }

      temporizadorAutomatico = setTimeout(executarCiclo, 1000);
    }

    if (abrindo || modo !== "celular") {
      return;
    }

    parar(false);

    const minhaSessao = sessao;

    abrindo = true;
    iniciarBotao.disabled = true;
    iniciarBotao.hidden = true;
    pararBotao.hidden = false;

    escrever("Solicitando permissão da câmera…");

    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Abra o site por HTTPS no Chrome ou Safari. " +
          "A câmera não está disponível neste navegador."
        );
      }

      const novoFluxo = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 960 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (minhaSessao !== sessao || document.hidden) {
        novoFluxo.getTracks().forEach(function (faixa) {
          faixa.stop();
        });
        return;
      }

      fluxo = novoFluxo;
      video.srcObject = fluxo;
      video.hidden = false;

      await video.play();

      if (minhaSessao !== sessao) {
        return;
      }

      escrever(
        "Câmera aberta. Análise automática ativada. " +
        "Aponte para os assentos e mantenha o celular estável. " +
        "Para encerrar, toque em Parar leitura."
      );

      iniciarAutomatico();

    } catch (erro) {
      if (minhaSessao !== sessao) {
        return;
      }

      parar(false);

      escrever(
        erro.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere a câmera nas configurações do navegador."
          : "Não consegui abrir a câmera: " + erro.message
      );

    } finally {
      if (minhaSessao === sessao) {
        abrindo = false;
      }
    }
  }

  async function capturarFoto() {
    if (
      !fluxo ||
      !fluxo.active ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      throw new Error(
        "A imagem ainda não está pronta. " +
        "Abra a câmera e aguarde alguns segundos."
      );
    }

    const escala = Math.min(
      1,
      960 / Math.max(video.videoWidth, video.videoHeight)
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
    canvas.height = Math.max(1, Math.round(video.videoHeight * escala));

    const contexto = canvas.getContext("2d");
    if (!contexto) {
      throw new Error("Não consegui preparar a foto.");
    }

    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(function (resolve) {
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
    } catch (erro) {
      throw new Error(
        "Não foi possível ler a resposta do sistema agora. Tente novamente."
      );
    }

    if (!resposta.ok) {
      throw new Error(
        "O sistema de análise está indisponível no momento. Tente novamente em instantes."
      );
    }

    return json;
  }

  function guardarLeitura(json, restante, fonte) {
    if (
      json.estado !== "recente" ||
      typeof json.mensagem !== "string" ||
      !json.mensagem.trim() ||
      !Number.isFinite(restante) ||
      restante <= 0
    ) {
      limparLeitura();

      escrever(
        json.estado === "expirado"
          ? "A leitura anterior venceu. Aguarde a próxima foto."
          : "Não foi possível identificar os assentos agora. Tente apontar a câmera novamente."
      );

      return false;
    }

    leitura = {
      fonte: fonte,
      mensagem: json.mensagem,
      expira: performance.now() + Math.min(VALIDADE_MS, restante)
    };

    escrever(textoAtual());
    return true;
  }


  async function analisarFoto() {
    escrever("Verificando a câmera…");

    if (modo !== "celular") {
      escrever("Selecione Câmera deste celular.");
      return;
    }

    if (ocupado) {
      escrever(
        "Uma análise já está em andamento. Aguarde. " +
        "Para cancelar, toque em Parar leitura."
      );
      return;
    }

    if (!fluxo || !fluxo.active) {
      escrever(
        "Primeiro toque em Começar leitura dos assentos " +
        "e permita o acesso."
      );
      return;
    }

    if (document.hidden) {
      escrever("Mantenha esta página visível para analisar.");
      return;
    }

    ocupado = true;
    limparLeitura();

    const minhaSessao = sessao;
    const abortador = new AbortController();
    controle = abortador;

    const prazo = setTimeout(function () {
      abortador.abort();
    }, 45000);

      try {
      escrever("Tirando foto dos assentos…");

      const capturadoEm = new Date().toISOString();
      const inicio = performance.now();
      const blob = await capturarFoto();

      if (minhaSessao !== sessao) {
        return;
      }

      const requisicaoId =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : Date.now() + "-" + Math.random().toString(36).slice(2);

      const formulario = new FormData();
      formulario.append("image", blob, "captura.jpg");
      formulario.append("capturadoEm", capturadoEm);
      formulario.append("requisicaoId", requisicaoId);

      escrever("Procurando assentos livres na imagem…");

      const resposta = await fetch(BACKEND + "/api/analisar", {
        method: "POST",
        body: formulario,
        signal: abortador.signal,
        cache: "no-store"
      });

      const json = await lerResposta(resposta);

      if (minhaSessao !== sessao) {
        return;
      }

      if (
        json.capturadoEm !== capturadoEm ||
        json.requisicaoId !== requisicaoId
      ) {
        throw new Error("A imagem analisada não é a atual. Tentando novamente.");
      }

      const idade = performance.now() - inicio;

      if (idade >= VALIDADE_MS) {
        escrever(
          "A análise demorou muito e foi descartada para sua segurança. Tentando uma nova foto."
        );
        return;
      }

      const restante = Math.min(
        VALIDADE_MS - idade,
        Number(json.validaPorSegundos) * 1000
      );

      if (guardarLeitura(json, restante, "celular")) {
        ouvirLeitura();
      }

    } catch (erro) {
      if (minhaSessao !== sessao) {
        return;
      }

      limparLeitura();

      escrever(
        erro.name === "AbortError"
          ? "O sistema demorou para responder. Aguarde um pouco e toque em Começar leitura dos assentos."
          : erro instanceof TypeError
            ? "Sem conexão com o sistema de análise. Verifique sua internet e tente de novo."
            : "Não foi possível analisar agora: " + erro.message
      );

    } finally {
      clearTimeout(prazo);

      if (controle === abortador) {
        controle = null;
      }

      if (minhaSessao === sessao) {
        ocupado = false;
      }
    }
  }

  async function consultarFixa(minhaSessao) {
    if (minhaSessao !== sessao || modo !== "fixa" || document.hidden) {
      return;
    }

    const inicio = performance.now();
    const abortador = new AbortController();
    controle = abortador;

    const prazo = setTimeout(function () {
      abortador.abort();
    }, 12000);

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

      if (minhaSessao !== sessao) {
        return;
      }

      const restante =
        Number(json.validaPorSegundos) * 1000 -
        (performance.now() - inicio);

      if (json.estado === "sem_leitura") {
        limparLeitura();

        escrever(
          "A câmera do ônibus ainda não enviou imagens. Aguarde um instante."
        );
      } else {
        guardarLeitura(json, restante, "fixa");
      }

    } catch (erro) {
      if (minhaSessao !== sessao) {
        return;
      }

      continuar = false;
      limparLeitura();
      iniciarBotao.disabled = false;
      iniciarBotao.hidden = false;
      pararBotao.hidden = true;

      escrever(
        "Não consegui conectar com a câmera do ônibus. " +
        (erro.name === "AbortError"
          ? "O sistema demorou para responder. Tente novamente."
          : "Verifique sua conexão e tente de novo.")
      );


    } finally {
      clearTimeout(prazo);

      if (controle === abortador) {
        controle = null;
      }

      if (continuar && minhaSessao === sessao && modo === "fixa") {
        temporizador = setTimeout(function () {
          consultarFixa(minhaSessao);
        }, 3000);
      }
    }
  }

  iniciarBotao.onclick = function () {
    if (modo === "celular") {
      abrirCamera();
    } else {
      parar(false);

      modo = "fixa";
      iniciarBotao.disabled = true;
      iniciarBotao.hidden = true;
      pararBotao.hidden = false;

      escrever("Consultando a câmera fixa…");
      consultarFixa(sessao);
    }
  };

  botoesFonte.forEach(function (botao) {
    botao.onclick = function () {
      const escolhido = botao.dataset.fonte;

      if (escolhido === modo && !fluxo && !temporizador) {
        return;
      }

      parar(false);
      modo = escolhido;

      botoesFonte.forEach(function (b) {
        b.setAttribute("aria-pressed", b === botao ? "true" : "false");
      });

      avisoFixa.hidden = modo !== "fixa";
      escrever("Toque no botão abaixo para começar a leitura.");
    };
  });

  el("ouvirCameraMobintec").onclick = ouvirLeitura;

  pararBotao.onclick = function () {
    parar();
  };

  painel.addEventListener("click", function (evento) {
    evento.stopPropagation();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      parar();
    }
  });

  window.addEventListener("pagehide", function () {
    parar(false);
  });

  setInterval(function () {
    if (leitura && !recente()) {
      limparLeitura();

      if (
        typeof ultimaFala !== "undefined" &&
        ultimaFala === ultimaMensagemCamera &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }

      escrever(
        "A leitura expirou. Analise uma foto nova " +
        "para obter outro resultado."
      );
    }
  }, 1000);

  if (typeof textoAssento === "function") {
    textoAssento = textoAtual;
  }

  if (typeof frasePrincipal === "function") {
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
        "Use o painel de câmera para uma análise independente."
      );
    };
  }

  if (typeof desenharPainel === "function") {
    desenharPainel = function () {
      if (!dados) {
        return;
      }

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
        Math.round(Math.min(1, Math.max(0, feito)) * 100) + "%";

      const mensagem =
        "Este destino não tem câmera vinculada. " +
        "Consulte o painel de câmera para uma análise " +
        "independente. Disponibilidade PCD não confirmada.";

      if (pegar("#textoCamera").textContent !== mensagem) {
        pegar("#textoCamera").textContent = mensagem;
      }
    };
  }

  if (typeof lerCamera === "function") {
    lerCamera = function () {};
  }

  if (typeof escolherDestino === "function") {
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
  }

  if (typeof responder === "function") {
    const responderOriginal = responder;

    responder = function (texto) {
      const limpo = semAcento(String(texto || ""));

      const sobreAssentos =
        /\b(assentos?|poltronas?|livres?|pcd)\b/.test(limpo) ||
        (
          /\blugares?\b/.test(limpo) &&
          /\b(sentar|onibus|vazio|vazios)\b/.test(limpo)
        ) ||
        /\b(ler|leitura)\b/.test(limpo);

      if (sobreAssentos) {
        ouvirLeitura();
        return;
      }

      responderOriginal(texto);
    };
  }

  if (typeof repetirUltima === "function") {
    const repetirOriginal = repetirUltima;

    repetirUltima = function () {
      if (ultimaMensagemCamera && ultimaFala === ultimaMensagemCamera) {
        ouvirLeitura();
      } else {
        repetirOriginal();
      }
    };
  }
})();

 
