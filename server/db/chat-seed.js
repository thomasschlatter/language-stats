// Starter chatter for the public per-language rooms, so a new visitor doesn't
// land in an empty room. Posted by the demo users. Idempotent: a room that
// already has messages is left alone.
import { getLanguageByCode } from '../models/languages.js';
import { getUserByUsername } from '../models/users.js';
import { listMessages, createMessage } from '../models/messages.js';

// [roomLangCode, [ [username, bodyLangCode, text], ... ]]
export const ROOM_CHATTER = [
  ['en-US', [
    ['noah', 'en-US', 'Hey everyone! Anyone up for practising English today?'],
    ['carla', 'en-US', 'Hi! From Valencia — happy to help with Spanish if you help me with English 😊'],
    ['lukas', 'en-US', 'German native here, improving my English. What are you all reading?'],
    ['mia', 'en-US', 'Just joined! Any podcast recommendations for beginners?'],
  ]],
  ['de-DE', [
    ['lukas', 'de-DE', 'Hallo zusammen! Wer lernt gerade Deutsch?'],
    ['mia', 'en-US', 'Hi everyone! Just started — any tips for the articles?'],
    ['ben', 'de-DE', 'Viel Erfolg! Schau dir die Karte über das Genus an.'],
    ['olivia', 'en-US', 'The gender card with the frequency buttons is great.'],
    ['sofia', 'de-DE', 'Ich übe jeden Tag zehn Minuten. Es hilft wirklich.'],
  ]],
  ['es-ES', [
    ['sofia', 'es-ES', '¡Hola a todos! ¿Alguien está aprendiendo español?'],
    ['noah', 'en-US', 'Trying to finally learn Spanish this year — any tips?'],
    ['emma', 'es-ES', 'Yo también aprendo español. ¡Practiquemos juntos!'],
    ['carla', 'es-ES', 'Si necesitáis ayuda con la pronunciación, preguntad 🙂'],
  ]],
  ['fr-FR', [
    ['mia', 'en-US', 'Bonjour! Just started French — how do you remember the genders?'],
    ['lukas', 'fr-FR', 'Salut ! En français il faut apprendre le genre avec le mot, comme en allemand.'],
    ['olivia', 'en-US', 'Anyone have a good French podcast for beginners?'],
  ]],
  ['it-IT', [
    ['ben', 'it-IT', 'Ciao a tutti! Chi sta imparando l’italiano?'],
    ['carla', 'es-ES', '¡Ciao! El italiano se parece mucho al español, ¿verdad?'],
    ['finn', 'it-IT', 'Sto iniziando adesso, felice di fare pratica insieme!'],
  ]],
  ['pt-PT', [
    ['carla', 'es-ES', '¡Olá! El portugués y el español se parecen bastante.'],
    ['noah', 'en-US', 'Learning European Portuguese — the pronunciation surprises me!'],
  ]],
  ['ja-JP', [
    ['noah', 'en-US', 'こんにちは! Just starting Japanese — hiragana first, right?'],
    ['mia', 'en-US', 'はじめまして！Learning Japanese for a trip. どうぞよろしく。'],
  ]],
  ['ko-KR', [
    ['olivia', 'en-US', '안녕하세요! Starting Korean — the alphabet is really fun to learn.'],
    ['finn', 'en-US', 'Same here! Hangul clicked faster than I expected 😄'],
  ]],
  ['zh-CN', [
    ['finn', 'en-US', '你好! Learning Mandarin. The tones are tricky 😅'],
    ['emma', 'en-US', 'Anyone know a good app for practising characters?'],
  ]],
];

// Insert the starter messages for any room that is currently empty.
export function seedChatRooms() {
  let rooms = 0;
  for (const [code, msgs] of ROOM_CHATTER) {
    const lang = getLanguageByCode(code);
    if (!lang) continue;
    if (listMessages(lang.id, 0, 1).length) continue; // already has messages
    for (const [username, bodyCode, body] of msgs) {
      const user = getUserByUsername(username);
      const bodyLang = getLanguageByCode(bodyCode);
      if (!user) continue;
      createMessage({ languageId: lang.id, bodyLangId: bodyLang?.id, userId: user.id, body });
    }
    rooms += 1;
  }
  return rooms;
}
