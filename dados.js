/* ==========================================================================
   MOBINTEC - BANCO DE DADOS INICIAL (Etapa 3)
   Aqui ficam os pontos turísticos, os transportes, as condições de acessibilidade e as fontes.
   O site e a assistente de IA usam estes dados. Para completar, edite só este arquivo.
   Regra: o que ainda não foi confirmado fica escrito "A confirmar". Nunca preencha um dado sem fonte.
   ========================================================================== */

// Ponto de embarque (fixo). Coordenadas APROXIMADAS: confira no Google Maps.
const EMBARQUE = { nome: "Centro de Foz (hotéis)", posicao: [-25.5163, -54.5854] };

// Campos de cada destino:
//   nome, foto, servico (transporte turístico), sigla (no mapa), posicao [latitude, longitude] (aproximada),
//   palavras (o que a pessoa pode dizer para escolher), descricao (o que é o lugar),
//   acessibilidade (condições para pessoas cegas ou com baixa visão), aConfirmar (o que falta confirmar),
//   fontes (links e endereços consultados) e contato.
const DESTINOS = [
  {
    nome: "Cataratas do Iguaçu", foto: "img/cataratas.jpg", servico: "Ônibus do Parque Nacional", sigla: "PN",
    posicao: [-25.6866, -54.4420], palavras: ["catarata"],
    descricao: "Quedas d'água do rio Iguaçu, dentro do Parque Nacional do Iguaçu.",
    acessibilidade: "A confirmar: piso tátil, corrimãos, guia para pessoas cegas, assento preferencial no ônibus do parque.",
    aConfirmar: ["Quem opera o ônibus do parque e se há rastreamento por GPS", "Condições de acessibilidade nas passarelas", "Horários e preços"],
    fontes: ["A preencher: site oficial do parque e da concessionária"], contato: "A confirmar"
  },
  {
    nome: "Parque das Aves", foto: "img/aves.jpg", servico: "Transfer turístico", sigla: "TT",
    posicao: [-25.6140, -54.4826], palavras: ["aves"],
    descricao: "Parque com aves da Mata Atlântica e de outras regiões, ao lado do Parque Nacional do Iguaçu.",
    acessibilidade: "A confirmar: trilhas, piso, orientação para pessoas cegas.",
    aConfirmar: ["Qual transporte turístico atende o parque", "Condições de acessibilidade", "Horários e preços"],
    fontes: ["Coordenadas: Wikipédia (Parque das Aves)"], contato: "A confirmar"
  },
  {
    nome: "Itaipu Binacional", foto: "img/itaipu.jpg", servico: "Ônibus panorâmico de Itaipu", sigla: "IT",
    posicao: [-25.4380, -54.5880], palavras: ["itaipu", "usina"],
    descricao: "Usina hidrelétrica do Brasil e do Paraguai, com passeios turísticos a partir do centro de visitantes.",
    acessibilidade: "A confirmar: acessibilidade do centro de visitantes e do ônibus panorâmico.",
    aConfirmar: ["Condições de acessibilidade do passeio", "Horários, preços e pontos de saída", "Contato oficial da área de turismo"],
    fontes: ["A preencher: site turismoitaipu.com.br"], contato: "A confirmar (telefone citado em matéria de 2022: (45) 3576-7000)"
  },
  {
    nome: "Marco das Três Fronteiras", foto: "img/marco.jpg", servico: "City Tour panorâmico", sigla: "CT",
    posicao: [-25.5974, -54.5912], palavras: ["marco", "fronteira"],
    descricao: "Ponto onde se encontram os rios Iguaçu e Paraná, com vista para a Argentina e o Paraguai.",
    acessibilidade: "A confirmar: calçadas, rampas, piso tátil.",
    aConfirmar: ["Qual empresa de city tour atende o local", "Condições de acessibilidade", "Horários"],
    fontes: ["A preencher"], contato: "A confirmar"
  },
  {
    nome: "Templo Budista Chen Tien", foto: "img/templo.jpg", servico: "City Tour panorâmico", sigla: "CT",
    posicao: [-25.5330, -54.5620], palavras: ["templo", "budista"],
    descricao: "Templo budista de arquitetura chinesa em Foz do Iguaçu.",
    acessibilidade: "A confirmar: acesso, escadas, piso, orientação para pessoas cegas.",
    aConfirmar: ["Localização exata (coordenada aproximada)", "Qual empresa de city tour atende o local", "Condições de acessibilidade", "Horário de visitação"],
    fontes: ["A preencher"], contato: "A confirmar"
  }
];