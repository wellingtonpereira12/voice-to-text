// Utilitário para formatar e arrumar a transcrição da fala (estilo Antigravity / IA clean)
export function formatAndPolishSpeech(rawText) {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // 1. Dicionário de comandos de pontuação falados em português
  const punctuationRules = [
    // Ponto final
    { regex: /\b(ponto final|ponto|final)\b/gi, replace: '.' },
    // Vírgula
    { regex: /\b(vírgula|virgula)\b/gi, replace: ',' },
    // Ponto de interrogação
    { regex: /\b(ponto de interrogação|ponto de interrogacao|interrogação|interrogacao)\b/gi, replace: '?' },
    // Ponto de exclamação
    { regex: /\b(ponto de exclamação|ponto de exclamacao|exclamação|exclamacao)\b/gi, replace: '!' },
    // Dois pontos
    { regex: /\b(dois pontos)\b/gi, replace: ':' },
    // Ponto e vírgula
    { regex: /\b(ponto e vírgula|ponto e virgula)\b/gi, replace: ';' },
    // Reticências
    { regex: /\b(reticências|reticencias|três pontos|tres pontos)\b/gi, replace: '...' },
    // Parágrafo e nova linha
    { regex: /\b(nova linha|novo parágrafo|novo paragrafo|parágrafo|paragrafo)\b/gi, replace: '\n\n' }
  ];

  punctuationRules.forEach(({ regex, replace }) => {
    text = text.replace(regex, replace);
  });

  // 2. Limpeza de espaços antes de pontuações
  // Exemplo: "olá , tudo bem ." -> "olá, tudo bem."
  text = text.replace(/\s+([.,!?:;])/g, '$1');

  // 3. Garantir espaço após pontuação se seguido de texto
  // Exemplo: "olá,tudo bem" -> "olá, tudo bem"
  text = text.replace(/([.,!?:;])(?=[^\s\d.,!?:;\n])/g, '$1 ');

  // 4. Remover múltiplos espaços em branco
  text = text.replace(/[ \t]+/g, ' ');

  // 5. Remover múltiplas quebras de linha em excesso (máximo 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Capitalização de início de frases
  // Primeira letra do texto
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Letra maiúscula após ponto, interrogação, exclamação ou quebra de linha
  text = text.replace(/([.?!]\s+|\n+)([a-z\u00C0-\u00FF])/g, (match, sep, char) => {
    return sep + char.toUpperCase();
  });

  // 7. Limpar pontuações duplicadas desnecessárias (ex: ".. " -> ". ")
  text = text.replace(/\.{2}(?!\.)/g, '.');

  return text.trim();
}
