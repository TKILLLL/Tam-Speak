import {
  BandScore,
  SpeechMetrics,
  EncryptedApiKey,
  IPAPhonetic,
  EmailAddress,
  User,
  PracticeSession,
  CustomTopic,
  VocabularyItem,
  InvalidBandScoreError,
  InvalidSpeechMetricsError,
} from '../domain/index';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Running TamSpeak Phase 1 Domain Layer Tests ---');

// 1. BandScore Tests
console.log('Testing BandScore invariants and IELTS rounding rules...');
const band7 = BandScore.create(7.0);
assert(band7.getValue() === 7.0, 'Band 7.0 value check');
assert(band7.toCEFR() === 'B2', 'Band 7.0 CEFR level');

const band85 = BandScore.create(8.5);
assert(band85.toCEFR() === 'C1', 'Band 8.5 CEFR level');

// IELTS Rounding: .25 rounds up to .5; .75 rounds up to next whole band
const roundedA = BandScore.fromRawAverage(6.25);
assert(roundedA.getValue() === 6.5, `IELTS rounding 6.25 -> 6.5 (got ${roundedA.getValue()})`);

const roundedB = BandScore.fromRawAverage(6.125);
assert(roundedB.getValue() === 6.0, `IELTS rounding 6.125 -> 6.0 (got ${roundedB.getValue()})`);

const roundedC = BandScore.fromRawAverage(6.75);
assert(roundedC.getValue() === 7.0, `IELTS rounding 6.75 -> 7.0 (got ${roundedC.getValue()})`);

let errorCaught = false;
try {
  BandScore.create(9.2); // Invalid: not multiple of 0.5
} catch (e) {
  if (e instanceof InvalidBandScoreError) {
    errorCaught = true;
  }
}
assert(errorCaught, 'BandScore(9.2) properly threw InvalidBandScoreError');

// 2. SpeechMetrics Tests
console.log('Testing SpeechMetrics invariants and client-side fluency factor...');
const metrics = SpeechMetrics.create({
  wpm: 130,
  hesitationCount: 2,
  silenceDurations: [0.9, 1.2],
  totalDurationSeconds: 60,
});
assert(metrics.getWpm() === 130, 'WPM check');
assert(metrics.getFluencyRating() === 'native_pace', 'Pace check');
assert(metrics.getTotalSilenceSeconds() === 2.1, 'Cumulative silence check');

let metricsError = false;
try {
  // Invalid: hesitation duration < 0.8s
  SpeechMetrics.create({
    wpm: 120,
    hesitationCount: 1,
    silenceDurations: [0.5],
    totalDurationSeconds: 30,
  });
} catch (e) {
  if (e instanceof InvalidSpeechMetricsError) {
    metricsError = true;
  }
}
assert(metricsError, 'SpeechMetrics rejected pause < 0.8s');

// 3. EncryptedApiKey Tests
console.log('Testing EncryptedApiKey Base64 invariants...');
const encryptedKey = EncryptedApiKey.create({
  ciphertext: 'c29tZV9lbmNyeXB0ZWRfY2lwaGVydGV4dA==',
  iv: 'AQIDBAUGBwgJCgsMDQ4PEA==',
  salt: 'AAECAwQFBgcICQoLDA0ODw==',
});
assert(encryptedKey.getCiphertext().length > 0, 'Ciphertext stored');

// 4. IPAPhonetic & Levenshtein Similarity Tests
console.log('Testing IPAPhonetic parsing and Levenshtein similarity...');
const ipa1 = IPAPhonetic.create('/həˈloʊ/');
assert(ipa1.getCleanedIPA() === 'həˈloʊ', 'IPA brackets stripped');
assert(ipa1.getSyllableCount() === 2, `Syllable count is 2 (got ${ipa1.getSyllableCount()})`);
assert(ipa1.getPrimaryStressSyllableIndex() === 1, 'Primary stress detected on second syllable');

const wordTarget = IPAPhonetic.create('bæd');
const wordClose = IPAPhonetic.create('bed');
const wordIdentical = IPAPhonetic.create('bæd');
assert(wordTarget.calculateSimilarity(wordIdentical) === 1.0, 'Identical IPA similarity = 1.0');
const closeSim = wordTarget.calculateSimilarity(wordClose);
assert(closeSim > 0.5 && closeSim < 1.0, `Close IPA similarity ~0.67 (got ${closeSim})`);

// 5. PracticeSession Composite Scoring State Machine
console.log('Testing PracticeSession state machine and 4-criterion IELTS scoring...');
const session = PracticeSession.create({
  id: 'sess-123',
  userId: 'user-456',
  mode: 'ielts_part2',
});
assert(session.status === 'created', 'Session starts in created');

session.startRecording();
assert(session.status === 'recording', 'Session transitions to recording');

session.appendDialogueTurn({
  id: 'turn-1',
  speaker: 'user',
  text: 'I would like to talk about a memorable journey I took last summer.',
  timestampSeconds: 5,
});
assert(session.transcriptDialogue.length === 1, 'Turn appended');

session.completeRecording(120, metrics);
assert(session.status === 'analyzing', 'Session transitions to analyzing');

session.finalizeEvaluation({
  pronunciationScore: BandScore.create(7.0),
  fluencyScore: BandScore.create(7.5),
  lexicalScore: BandScore.create(8.0),
  grammarScore: BandScore.create(7.0),
  detailedFeedback: {
    summary: 'Great coherent response with broad topic-specific vocabulary.',
    strengths: ['Natural intonation', 'Effective complex sentences'],
    weaknesses: ['Minor pause at transition'],
    suggestedPhrases: [],
    grammarCorrections: [],
    vocabularyEnhancements: [],
  },
  aiProviderUsed: 'gemini_flash',
});
// Average = (7.0 + 7.5 + 8.0 + 7.0) / 4 = 29.5 / 4 = 7.375 -> Rounds to 7.5
assert(session.status === 'completed', 'Session transitions to completed');
assert(session.overallScore !== null && session.overallScore.getValue() === 7.5, `Overall IELTS score is 7.5 (got ${session.overallScore?.getValue()})`);

// 5b. CustomTopic Tests
console.log('Testing CustomTopic roleplay prompt generation and keyword deduplication...');
const topic = CustomTopic.create({
  id: 'top-1',
  userId: 'user-456',
  title: 'Job Interview at Tech Startup',
  description: 'A mock interview for a Senior Fullstack Engineer position.',
  contextPrompt: 'Focus on system design and clean architecture questions.',
  aiRole: 'Hiring Manager',
  userRole: 'Candidate',
  targetKeywords: ['scalability', 'microservices', 'Scalability'], // test deduplication
  targetLevel: 'c1',
});
assert(topic.targetKeywords.length === 2, `Keywords deduplicated to 2 (got ${topic.targetKeywords.length})`);
const roleplayPrompt = topic.generateRoleplayInstruction();
assert(roleplayPrompt.includes('Hiring Manager'), 'AI Role included in prompt');
assert(roleplayPrompt.includes('Candidate'), 'User Role included in prompt');
assert(roleplayPrompt.includes('scalability'), 'Keyword included in prompt');

// 6. VocabularyItem Spaced Repetition (Leitner System)
console.log('Testing VocabularyItem Leitner Spaced Repetition...');
const vocab = VocabularyItem.create({
  id: 'v-1',
  userId: 'user-456',
  word: 'meticulous',
  definitionEn: 'Showing great attention to detail; very careful and precise.',
  ipa: IPAPhonetic.create('/məˈtɪkjələs/'),
});
assert(vocab.masteryLevel === 1, 'Initial mastery level is 1');

vocab.recordReviewSuccess(new Date('2026-10-26T00:00:00Z'));
assert(vocab.masteryLevel === 2, 'Mastery promoted to level 2');
assert(vocab.nextReviewDate === '2026-10-29', `Next review in 3 days (got ${vocab.nextReviewDate})`);

vocab.recordReviewFailure(new Date('2026-10-29T00:00:00Z'));
assert(vocab.masteryLevel === 1, 'Failure resets mastery to level 1');
assert(vocab.nextReviewDate === '2026-10-30', 'Review scheduled for tomorrow');

// 7. User Streak Business Logic
console.log('Testing User daily streak progression...');
const user = User.create({
  id: 'u-1',
  email: EmailAddress.create('user@tamspeak.ai'),
  displayName: 'Tam Phan',
});
assert(user.streakDays === 0, 'Initial streak 0');

user.recordPracticeSession(300, new Date('2026-10-25T10:00:00Z'));
assert(user.streakDays === 1, 'First day streak is 1');

// Next day practice
user.recordPracticeSession(600, new Date('2026-10-26T10:00:00Z'));
assert(user.streakDays === 2, 'Consecutive day streak is 2');
assert(user.totalPracticeMinutes === 15, 'Total minutes aggregated (5 + 10 = 15)');

console.log('✅ ALL PHASE 1 DOMAIN TESTS PASSED WITH 100% SUCCESS!');
