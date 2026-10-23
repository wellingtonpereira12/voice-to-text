// Utilitário avançado para formatar, pontuar e arrumar a transcrição da fala
export function formatAndPolishSpeech(rawText) {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // 1. Dicionário de comandos de pontuação falados explicitamente
  const punctuationRules = [
    { regex: /\b(ponto final|ponto|final)\b/gi, replace: '.' },
    { regex: /\b(vírgula|virgula)\b/gi, replace: ',' },
    { regex: /\b(ponto de interrogação|ponto de interrogacao|interrogação|interrogacao)\b/gi, replace: '?' },
    { regex: /\b(ponto de exclamação|ponto de exclamacao|exclamação|exclamacao)\b/gi, replace: '!' },
    { regex: /\b(dois pontos)\b/gi, replace: ':' },
    { regex: /\b(ponto e vírgula|ponto e virgula)\b/gi, replace: ';' },
    { regex: /\b(reticências|reticencias|três pontos|tres pontos)\b/gi, replace: '...' },
    { regex: /\b(nova linha|novo parágrafo|novo paragrafo|parágrafo|paragrafo)\b/gi, replace: '\n\n' }
  ];

  punctuationRules.forEach(({ regex, replace }) => {
    text = text.replace(regex, replace);
  });

  // 2. Remoção de gaguejos e palavras duplicadas consecutivas da fala (ex: "tá tá", "é é", "o o")
  text = text.replace(/\b([a-zA-Z\u00C0-\u00FF]+)\s+\1\b/gi, '$1');

  // 3. Pontuação inteligente em conectivos adversativos, explicativos e conclusivos
  // Adiciona vírgula antes de conjunções comuns caso não haja pontuação anterior
  const conjunctions = [
    'mas', 'porém', 'contudo', 'todavia', 'no entanto',
    'porque', 'pois', 'já que', 'visto que',
    'portanto', 'por isso', 'sendo assim', 'então', 'daí',
    'ou seja', 'isto é', 'além disso', 'por exemplo'
  ];

  conjunctions.forEach((conj) => {
    const regex = new RegExp(`(?<=[^.,!?:;\\n\\s])\\s+(${conj})\\b`, 'gi');
    text = text.replace(regex, ', $1');
  });

  // 4. Fechamento de termos interrogativos ao final da frase (ex: ", né?", ", beleza?", ", certo?")
  text = text.replace(/(?<=[^.,!?:;])\s+(né|beleza|entendeu|certo|sabe|tá ligado)\s*([.,]?)/gi, ', $1?');

  // 5. Quebra de sentenças muito longas (> 15 palavras) antes de transições
  const words = text.split(/\s+/);
  if (words.length > 15) {
    text = text.replace(/(?<=[a-zA-Z0-9\u00C0-\u00FF]{3,})\s+(e daí|depois disso|além disso|outro ponto|outra coisa)\s+/gi, '. $1 ');
  }

  // 6. Limpeza de espaços antes de pontuações
  text = text.replace(/\s+([.,!?:;])/g, '$1');

  // 7. Garantir espaço após pontuação se seguido de texto
  text = text.replace(/([.,!?:;])(?=[^\s\d.,!?:;\n])/g, '$1 ');

  // 8. Remover múltiplos espaços em branco
  text = text.replace(/[ \t]+/g, ' ');

  // 9. Garantir que todo texto finalize com pontuação adequada (. ou ?)
  const trimmed = text.trim();
  const lastChar = trimmed.slice(-1);
  if (!['.', '?', '!', ':', ';', '…'].includes(lastChar)) {
    // Se a frase começou com pronome interrogativo, finaliza com ?
    const isQuestion = /^(como|quando|onde|por que|porque|quem|qual|quanto|será|será que|o que|você|tu|dá pra|tem como)\b/i.test(trimmed);
    text = trimmed + (isQuestion ? '?' : '.');
  }

  // 10. Capitalização de início de frases e após pontuação (. ? ! \n)
  text = text.charAt(0).toUpperCase() + text.slice(1);
  text = text.replace(/([.?!]\s+|\n+)([a-z\u00C0-\u00FF])/g, (match, sep, char) => {
    return sep + char.toUpperCase();
  });

  // 11. Limpar pontuações estranhas duplicadas (ex: ",." ou ".,")
  text = text.replace(/,\s*\./g, '.');
  text = text.replace(/\.\s*,/g, '.');
  text = text.replace(/\?+/g, '?');
  text = text.replace(/\!+/g, '!');
  text = text.replace(/\.{2}(?!\.)/g, '.');

  return text.trim();
}
