// Conversation-practice scenarios. The LLM role-plays the NPC in the learner's
// target language so they can practice a real situation.
export const SCENARIOS = [
  { id: 'restaurant', emoji: '🍽️', title: 'At a restaurant', role: 'a friendly waiter at a restaurant', situation: 'The learner is a customer. Greet them, help them order food and drinks, answer questions about the menu, and bring the bill at the end.' },
  { id: 'doctor', emoji: '🩺', title: "At the doctor's", role: 'a kind doctor', situation: 'The learner is a patient. Ask what is wrong, ask about their symptoms, and give simple advice.' },
  { id: 'directions', emoji: '🗺️', title: 'Asking directions', role: 'a helpful local on the street', situation: 'The learner is a tourist who is lost. Help them find their way to places like the station, a museum, or their hotel.' },
  { id: 'shopping', emoji: '🛍️', title: 'Shopping for clothes', role: 'a shop assistant in a clothing store', situation: 'The learner is a customer. Help them find clothes, sizes, colours and prices, and check out.' },
  { id: 'hotel', emoji: '🏨', title: 'Hotel check-in', role: 'a hotel receptionist', situation: 'The learner is a guest checking in. Handle their reservation, room, keys, breakfast times, and questions.' },
  { id: 'cafe', emoji: '☕', title: 'Small talk at a café', role: 'a friendly stranger at a café', situation: 'The learner sits nearby. Make light small talk about the weather, where they are from, what they do, and hobbies.' },
  { id: 'job', emoji: '💼', title: 'Job interview', role: 'a polite interviewer for a job', situation: 'The learner is a candidate. Ask about their experience, strengths, and why they want the job.' },
  { id: 'phone', emoji: '📞', title: 'Booking by phone', role: 'a receptionist taking a booking over the phone', situation: 'The learner is calling to book something (a table, an appointment, a room). Take their details and confirm.' },
];
