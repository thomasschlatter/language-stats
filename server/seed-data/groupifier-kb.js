// Knowledge base for the "Chat with @Groupifier" help assistant. PUBLIC app
// facts only — no user data. Each entry: q (topic), keywords, a (answer), link.
export const KB = [
  {
    q: 'What is Groupifier?',
    keywords: 'what is groupifier about app purpose overview',
    a: 'Groupifier is a language-learning platform that combines a shared dictionary, flashcards, community tips, group chats, and a multiplayer world.',
    link: '#/tips',
  },
  {
    q: 'How do flashcard decks work?',
    keywords: 'flashcard deck cards study srs review spaced repetition',
    a: 'Decks are studied with spaced repetition. Open Flashcards, import a CSV/Anki file or generate a deck, then study due cards. Each card can link to a dictionary sense.',
    link: '#/decks',
  },
  {
    q: 'What are shared and official decks?',
    keywords: 'shared official deck browse upvote add community textbook exam',
    a: 'Browse shared decks to find official (Groupifier), textbook, exam-board, and community decks. You can upvote them and add any to your own collection.',
    link: '#/decks/browse',
  },
  {
    q: 'How do I make a deck from a tip?',
    keywords: 'anki list tip markdown make deck list to deck',
    a: 'In a tip, any list can become a deck. Use an [anki] list in the editor to get buttons that add the list as a new deck or append it to an existing one.',
    link: '#/tips',
  },
  {
    q: 'What is the dictionary / senses?',
    keywords: 'dictionary word sense definition meaning link vote wordnet concepticon',
    a: 'Every word is clickable and has a dictionary page with multiple senses (from WordNet, Concepticon, Wiktionary, and users). Senses are upvotable and ranked by how many cards link to them.',
    link: '#/tips',
  },
  {
    q: 'How do tips work?',
    keywords: 'tips advice share community write markdown language learning',
    a: 'Tips are community language-learning advice written in markdown. Share a tip for any language; readers can turn its lists into flashcard decks.',
    link: '#/tips',
  },
  {
    q: 'What are Groups?',
    keywords: 'group groups chat invite link create join friends',
    a: 'Groups are private group chats. Create a group, share the invite link to add friends, and chat inside. Say @foxy in a group to talk to the bot.',
    link: '#/groups',
  },
  {
    q: 'What is the World?',
    keywords: 'world multiplayer game map avatar move meet people',
    a: 'The World is a multiplayer space where you move an avatar, meet other learners, and play mini-games. Camera and mic are off by default.',
    link: '#/world',
  },
  {
    q: 'How many languages are supported?',
    keywords: 'languages how many list add native learning supported catalogue',
    a: 'Groupifier has a catalogue of thousands of languages. Common ones show by default; search to add any language, including rarer ones, as native or learning.',
    link: '#/tips',
  },
  {
    q: 'How do I find a language partner?',
    keywords: 'partner community find people exchange chat native',
    a: 'Use Community to find partners by the languages they speak and learn, then message them or start a group.',
    link: '#/community',
  },
  {
    q: 'Who is Foxy?',
    keywords: 'foxy bot assistant chat local model who',
    a: 'Foxy is a friendly bot that runs on a local model. Say @foxy in a group chat or the World to talk to it.',
    link: '#/groups',
  },
];
