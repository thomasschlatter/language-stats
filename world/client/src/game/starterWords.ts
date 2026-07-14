// Bundled starter vocabulary (common words → English) so the word games are
// playable immediately, even before a user has built any flashcard decks.
// Keyed by 2-letter language code; region variants (de-DE, pt-BR…) fall back to
// the base code. Used only when the player has fewer than 4 real cards.
export const STARTER: Record<string, { front: string; answer: string }[]> = {
  de: [
    { front: 'Hallo', answer: 'hello' }, { front: 'Danke', answer: 'thank you' }, { front: 'Ja', answer: 'yes' }, { front: 'Nein', answer: 'no' },
    { front: 'Wasser', answer: 'water' }, { front: 'Brot', answer: 'bread' }, { front: 'Haus', answer: 'house' }, { front: 'Katze', answer: 'cat' },
    { front: 'Hund', answer: 'dog' }, { front: 'Buch', answer: 'book' }, { front: 'Freund', answer: 'friend' }, { front: 'Liebe', answer: 'love' },
    { front: 'Zeit', answer: 'time' }, { front: 'Tag', answer: 'day' }, { front: 'Nacht', answer: 'night' }, { front: 'Essen', answer: 'food' },
  ],
  es: [
    { front: 'Hola', answer: 'hello' }, { front: 'Gracias', answer: 'thank you' }, { front: 'Sí', answer: 'yes' }, { front: 'No', answer: 'no' },
    { front: 'Agua', answer: 'water' }, { front: 'Pan', answer: 'bread' }, { front: 'Casa', answer: 'house' }, { front: 'Gato', answer: 'cat' },
    { front: 'Perro', answer: 'dog' }, { front: 'Libro', answer: 'book' }, { front: 'Amigo', answer: 'friend' }, { front: 'Amor', answer: 'love' },
    { front: 'Tiempo', answer: 'time' }, { front: 'Día', answer: 'day' }, { front: 'Noche', answer: 'night' }, { front: 'Comida', answer: 'food' },
  ],
  fr: [
    { front: 'Bonjour', answer: 'hello' }, { front: 'Merci', answer: 'thank you' }, { front: 'Oui', answer: 'yes' }, { front: 'Non', answer: 'no' },
    { front: 'Eau', answer: 'water' }, { front: 'Pain', answer: 'bread' }, { front: 'Maison', answer: 'house' }, { front: 'Chat', answer: 'cat' },
    { front: 'Chien', answer: 'dog' }, { front: 'Livre', answer: 'book' }, { front: 'Ami', answer: 'friend' }, { front: 'Amour', answer: 'love' },
    { front: 'Temps', answer: 'time' }, { front: 'Jour', answer: 'day' }, { front: 'Nuit', answer: 'night' }, { front: 'Nourriture', answer: 'food' },
  ],
  it: [
    { front: 'Ciao', answer: 'hello' }, { front: 'Grazie', answer: 'thank you' }, { front: 'Sì', answer: 'yes' }, { front: 'No', answer: 'no' },
    { front: 'Acqua', answer: 'water' }, { front: 'Pane', answer: 'bread' }, { front: 'Casa', answer: 'house' }, { front: 'Gatto', answer: 'cat' },
    { front: 'Cane', answer: 'dog' }, { front: 'Libro', answer: 'book' }, { front: 'Amico', answer: 'friend' }, { front: 'Amore', answer: 'love' },
    { front: 'Tempo', answer: 'time' }, { front: 'Giorno', answer: 'day' }, { front: 'Notte', answer: 'night' }, { front: 'Cibo', answer: 'food' },
  ],
  pt: [
    { front: 'Olá', answer: 'hello' }, { front: 'Obrigado', answer: 'thank you' }, { front: 'Sim', answer: 'yes' }, { front: 'Não', answer: 'no' },
    { front: 'Água', answer: 'water' }, { front: 'Pão', answer: 'bread' }, { front: 'Casa', answer: 'house' }, { front: 'Gato', answer: 'cat' },
    { front: 'Cão', answer: 'dog' }, { front: 'Livro', answer: 'book' }, { front: 'Amigo', answer: 'friend' }, { front: 'Amor', answer: 'love' },
    { front: 'Tempo', answer: 'time' }, { front: 'Dia', answer: 'day' }, { front: 'Noite', answer: 'night' }, { front: 'Comida', answer: 'food' },
  ],
  ja: [
    { front: 'こんにちは', answer: 'hello' }, { front: 'ありがとう', answer: 'thank you' }, { front: 'はい', answer: 'yes' }, { front: 'いいえ', answer: 'no' },
    { front: '水', answer: 'water' }, { front: 'パン', answer: 'bread' }, { front: '家', answer: 'house' }, { front: '猫', answer: 'cat' },
    { front: '犬', answer: 'dog' }, { front: '本', answer: 'book' }, { front: '友達', answer: 'friend' }, { front: '愛', answer: 'love' },
    { front: '時間', answer: 'time' }, { front: '日', answer: 'day' }, { front: '夜', answer: 'night' }, { front: '食べ物', answer: 'food' },
  ],
  ko: [
    { front: '안녕하세요', answer: 'hello' }, { front: '감사합니다', answer: 'thank you' }, { front: '네', answer: 'yes' }, { front: '아니요', answer: 'no' },
    { front: '물', answer: 'water' }, { front: '빵', answer: 'bread' }, { front: '집', answer: 'house' }, { front: '고양이', answer: 'cat' },
    { front: '개', answer: 'dog' }, { front: '책', answer: 'book' }, { front: '친구', answer: 'friend' }, { front: '사랑', answer: 'love' },
    { front: '시간', answer: 'time' }, { front: '하루', answer: 'day' }, { front: '밤', answer: 'night' }, { front: '음식', answer: 'food' },
  ],
  zh: [
    { front: '你好', answer: 'hello' }, { front: '谢谢', answer: 'thank you' }, { front: '是', answer: 'yes' }, { front: '不', answer: 'no' },
    { front: '水', answer: 'water' }, { front: '面包', answer: 'bread' }, { front: '家', answer: 'house' }, { front: '猫', answer: 'cat' },
    { front: '狗', answer: 'dog' }, { front: '书', answer: 'book' }, { front: '朋友', answer: 'friend' }, { front: '爱', answer: 'love' },
    { front: '时间', answer: 'time' }, { front: '天', answer: 'day' }, { front: '夜', answer: 'night' }, { front: '食物', answer: 'food' },
  ],
}
