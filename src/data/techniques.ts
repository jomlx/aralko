import type { Technique } from '../types';

export const techniques: Technique[] = [
  {
    name: 'Spaced Repetition',
    shortDescription: 'Review material at increasing intervals to combat the forgetting curve.',
    fullDescription: 'Spaced repetition is an evidence-based learning technique that involves reviewing information at gradually increasing intervals. Instead of cramming all studying into a single session, you space out your reviews over days, weeks, and months. This leverages a psychological phenomenon called the spacing effect.\n\nWhen you first learn something, the memory is fragile and decays quickly. By reviewing the material just as you are about to forget it, you strengthen the memory trace and decrease the rate of future forgetting, leading to durable long-term retention.',
    steps: [
      'Create flashcards or notes for the material you need to learn.',
      'Review the material shortly after first learning it (e.g., within 24 hours).',
      'If you successfully recall the information, schedule the next review for a longer interval (e.g., 3 days, then 1 week, then 1 month).',
      'If you struggle or forget, review the material again immediately and reset its review interval to be shorter.',
      'Use software tools (like Anki) or a physical Leitner box system to automate the scheduling of your reviews.'
    ],
    icon: 'Brain'
  },
  {
    name: 'Active Recall',
    shortDescription: 'Actively stimulate your memory during the learning process.',
    fullDescription: 'Active recall is the process of deliberately retrieving information from memory without looking at your notes or textbook. It contrasts with passive review methods like re-reading or highlighting, which can create an illusion of competence.\n\nThe effort required to recall information actually strengthens neural pathways associated with that knowledge. When you force your brain to search for an answer, you are cementing the information deeper into your memory, making it much easier to retrieve during an actual exam or when needed.',
    steps: [
      'Read a section of your textbook or notes, then close the book.',
      'Write down or explain aloud everything you can remember about what you just read.',
      'Check your notes to see what you missed or got wrong.',
      'Focus your next study session on the areas where your recall was weak.',
      'Use practice tests and flashcards as tools to enforce active retrieval.'
    ],
    icon: 'Target'
  },
  {
    name: 'Feynman Technique',
    shortDescription: 'Learn by explaining concepts in simple terms as if teaching someone else.',
    fullDescription: 'Named after the Nobel Prize-winning physicist Richard Feynman, this technique is a mental model for understanding complex subjects. The core idea is that you don\'t truly understand something unless you can explain it simply. By attempting to teach a concept, you quickly identify gaps in your own knowledge.\n\nThis method forces you to strip away jargon and complexity, reducing the material to its fundamental components. It is particularly effective for grasping abstract theories or intricate processes in science, math, and philosophy.',
    steps: [
      'Choose a concept you want to understand and write its name at the top of a blank piece of paper.',
      'Write down an explanation of the concept as if you were teaching it to a sixth-grader. Use simple language and analogies.',
      'Identify the parts of your explanation where you struggled, resorted to jargon, or had gaps in your knowledge.',
      'Go back to your source material to relearn those specific weak areas until you can explain them simply.',
      'Refine your explanation, ensuring it flows logically and is free of unnecessary complexity.'
    ],
    icon: 'BookOpen'
  },
  {
    name: 'Exam Me',
    shortDescription: 'Generate a personalized exam to test your knowledge.',
    fullDescription: 'The Exam Me technique leverages AI to dynamically generate a practice test based on your specific study notes. Simulating exam conditions is one of the most effective ways to prepare for the real thing, as it familiarizes you with the pressure and format of questions you might encounter.\n\nBy taking a generated exam, you can identify blind spots in your understanding and practice retrieving information under realistic conditions. It shifts your study mode from passive review to active application.',
    steps: [
      'Ensure your study notes are comprehensive and up-to-date in your workspace.',
      'Select the "Exam Me" technique to instruct the AI to generate a quiz.',
      'Take the exam without referring back to your notes.',
      'Review your answers and identify any weak areas.',
      'Return to your notes to restudy the topics you struggled with on the exam.'
    ],
    icon: 'PenTool'
  },
  {
    name: 'Interleaving',
    shortDescription: 'Mix different topics or subjects in a single study session.',
    fullDescription: 'Interleaving is a study strategy where you mix different topics, concepts, or subjects within a single study session, rather than studying one topic extensively before moving on to the next (known as blocking). By switching between topics, you force your brain to continually adjust and recognize patterns.\n\nThis approach helps you not only learn the individual concepts but also understand the differences between them and when to apply specific strategies. While interleaving can feel more difficult and slower initially compared to blocked practice, it leads to significantly better long-term retention and transfer of knowledge.',
    steps: [
      'Select a few different but related topics or problem types you need to study.',
      'Divide your study session into smaller blocks of time (e.g., 20 minutes per topic).',
      'Study topic A, then switch to topic B, then topic C, before returning to A. Do not study one topic for too long.',
      'As you switch, try to make connections between the different topics.',
      'Ensure the topics you interleave are somewhat related so that you are practicing distinguishing between similar concepts.'
    ],
    icon: 'LayoutDashboard'
  },
  {
    name: 'Flashcards',
    shortDescription: 'Use two-sided cards for rapid testing of facts and definitions.',
    fullDescription: 'Flashcards are a simple yet highly effective tool for memorization. A flashcard typically has a question, term, or prompt on one side and the answer or definition on the other. They are the perfect vehicle for implementing both active recall and spaced repetition.\n\nFlashcards are best used for factual information, vocabulary, dates, and simple formulas. They isolate individual pieces of information, allowing you to quickly self-test and identify exactly which facts you know and which require further review. Digital flashcard apps have further enhanced this method by automating the spaced repetition scheduling.',
    steps: [
      'Identify key terms, definitions, dates, or formulas from your study material.',
      'Create a flashcard for each item: write a clear, concise question on the front and the exact answer on the back.',
      'Keep the information on each card minimal; avoid putting too much text on a single card.',
      'Review your deck of cards regularly, reading the front and attempting to recall the back before flipping it over.',
      'Shuffle the cards frequently to avoid memorizing the order of the answers rather than the content.'
    ],
    icon: 'Check'
  }
];
