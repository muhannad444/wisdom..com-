/*
 * Little Wisdom — "Discover what you need".
 *
 * Matches the REAL quote collection to a feeling or a topic. Nothing here is a quote: it only
 * describes what each option looks for, using the tags, categories and keywords already on every quote.
 *   tags   : { tag: weight }    strongest signal
 *   cats   : { category: weight }
 *   words  : words looked for in the English title/text (whole-word start match)
 *   pin    : quote numbers hand-checked as especially fitting (a bonus, never a replacement for matching)
 * A new entry is picked up automatically, with no code change, in any of three ways:
 *   1. it is assigned to an option directly (entry.topics = ['feel:lonely', 'topic:patience'])  -> always shown
 *   2. one of its tags names the option or one of its synonyms (tag "loneliness" -> "Lonely")
 *   3. its tags/categories match the option's weighted tags
 * Keywords alone can never qualify an entry (one keyword is worth less than MIN_SCORE).
 * Every entry scoring at least MIN_SCORE is shown, strongest first. Nothing is capped.
 */
(function (root) {
  'use strict';

  const MIN_SCORE = 3, PIN_BONUS = 5, ASSIGN_BONUS = 12, NAME_BONUS = 6;

  // Synonyms: a tag equal to the option's id, its English name or one of these connects an entry to the option.
  const SYNONYMS = {
    unmotivated: ['motivation', 'demotivated', 'procrastination', 'consistency', 'drive'],
    overwhelmed: ['overwhelm', 'too-much', 'burnout'],
    confused: ['confusion', 'clarity', 'uncertainty'],
    stressed: ['stress', 'pressure', 'anxiety'],
    lonely: ['loneliness', 'isolation', 'disconnected', 'disconnection', 'belonging', 'social-connection', 'connection', 'self-worth', 'friendship'],
    worried: ['worry', 'anxiety', 'fear', 'overthinking'],
    frustrated: ['frustration', 'anger', 'setbacks'],
    insecure: ['insecurity', 'self-doubt', 'self-worth', 'self-esteem', 'comparison', 'confidence'],
    distracted: ['distraction', 'focus', 'attention'],
    impatient: ['impatience', 'patience', 'waiting'],
    tired: ['tiredness', 'exhaustion', 'rest', 'fatigue', 'burnout'],
    happy: ['happiness', 'joy', 'contentment'],
    confident: ['confidence', 'self-belief', 'courage'],
    curious: ['curiosity', 'wonder'],
    grateful: ['gratitude', 'thankfulness', 'appreciation'],
    intelligence: ['intelligent', 'smart', 'iq'],
    learning: ['learn', 'study', 'education'],
    patience: ['patient', 'waiting'],
    productivity: ['productive', 'efficiency', 'time-management'],
    success: ['succeed', 'achievement'],
    creativity: ['creative', 'creating', 'imagination'],
    'work-ethic': ['hard-work', 'effort', 'diligence'],
    'goal-achievement': ['goals', 'goal', 'goal-setting', 'achieving-goals'],
    'personal-development': ['growth', 'self-improvement', 'self-development', 'personal-growth'],
    business: ['sales', 'product', 'marketing', 'strategy'],
    entrepreneurship: ['entrepreneur', 'startup', 'founder', 'building'],
    psychology: ['mind', 'mindset', 'emotions', 'behaviour', 'behavior', 'habits'],
    perspective: ['framing', 'mindset', 'outlook'],
    'self-control': ['restraint', 'self-discipline', 'willpower', 'temptation'],
    knowledge: ['wisdom', 'understanding'],
    skills: ['skill', 'mastery', 'practice', 'craft'],
    'decision-making': ['decisions', 'choices', 'choice', 'judgement', 'judgment'],
    integrity: ['honesty', 'authenticity', 'character'],
    environment: ['surroundings', 'influences', 'company']
  };
  const slug = function (x) { return String(x || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\u0600-\u06ff-]/g, ''); };

  const FEELINGS = [
    { id: 'unmotivated', en: 'Unmotivated', ar: 'قلة الحافز', face: 'flat',
      tags: { action: 3, discipline: 3, 'hard-work': 3, determination: 3, excuses: 3, beginnings: 2, goals: 2, endurance: 2, habits: 1 }, pin: [13, 59, 46, 35, 7, 52] },
    { id: 'overwhelmed', en: 'Overwhelmed', ar: 'ضغط المهام', face: 'swirl',
      tags: { priorities: 3, order: 3, beginnings: 2, focus: 2, perspective: 2, time: 1, composure: 1 }, pin: [35, 10, 17, 70, 6, 32] },
    { id: 'confused', en: 'Confused', ar: 'ارتباك', face: 'puzzled',
      tags: { understanding: 3, questions: 3, learning: 2, knowledge: 2, 'self-awareness': 2, reflection: 2, wisdom: 1, thinking: 1 }, pin: [44, 64, 20, 26, 15, 31, 76] },
    { id: 'stressed', en: 'Stressed', ar: 'توتر', face: 'sweat',
      tags: { perspective: 3, composure: 3, resilience: 2, restraint: 2, 'hard-times': 2, trust: 2, surrender: 2, faith: 1 }, pin: [70, 62, 42, 2, 39, 8, 76] },
    { id: 'lonely', en: 'Lonely', ar: 'وحدة', face: 'tear',
      tags: { love: 2, kindness: 2, hope: 2, 'self-talk': 3, trust: 2, feelings: 2, honesty: 1, identity: 1 }, pin: [55, 36, 37, 29, 5, 54] },
    { id: 'worried', en: 'Worried', ar: 'قلق', face: 'worried',
      tags: { fear: 3, trust: 3, faith: 2, surrender: 2, hope: 2, perspective: 2, feelings: 1 }, pin: [8, 42, 29, 70, 37, 76] },
    { id: 'frustrated', en: 'Frustrated', ar: 'إحباط', face: 'angry',
      tags: { composure: 3, endurance: 3, resilience: 2, determination: 2, failure: 2, 'hard-times': 2, restraint: 2, perspective: 1 }, pin: [72, 56, 14, 30, 46, 12, 76] },
    { id: 'insecure', en: 'Insecure', ar: 'قلة الثقة', face: 'unsure',
      tags: { identity: 3, originality: 3, 'self-talk': 3, 'self-awareness': 2, choices: 2, independence: 1, growth: 1 }, pin: [55, 1, 54, 71, 19, 25] },
    { id: 'distracted', en: 'Distracted', ar: 'تشتّت', face: 'sideways',
      tags: { focus: 3, phone: 3, discipline: 2, habits: 2, priorities: 2, mornings: 2, restraint: 2, addiction: 2 }, pin: [60, 6, 7, 23, 47, 17] },
    { id: 'impatient', en: 'Impatient', ar: 'نفاد الصبر', face: 'eyeroll', words: ['patien'],
      tags: { restraint: 3, endurance: 3, beginnings: 1 }, pin: [56, 72, 30, 49] },
    { id: 'tired', en: 'Tired', ar: 'تعب', face: 'yawn',
      tags: { endurance: 3, resilience: 2, 'hard-times': 2, hope: 2, trust: 2 }, pin: [30, 14, 37, 39, 42] },
    { id: 'happy', en: 'Happy', ar: 'سعادة', face: 'smile',
      tags: { happiness: 3, love: 2, passion: 2, purpose: 2, dreams: 1, success: 1 }, pin: [21, 45, 3, 36] },
    { id: 'confident', en: 'Confident', ar: 'ثقة', face: 'smirk',
      tags: { originality: 3, identity: 2, independence: 2, skills: 2, mastery: 2, 'self-talk': 2, action: 2 }, pin: [1, 25, 55, 22, 6, 35] },
    { id: 'curious', en: 'Curious', ar: 'فضول', face: 'curious',
      tags: { curiosity: 3, questions: 3, knowledge: 3, learning: 2, understanding: 1, creating: 1 }, pin: [15, 26, 44, 28, 61, 48] },
    { id: 'grateful', en: 'Grateful', ar: 'امتنان', face: 'glow', words: ['grateful', 'thank', 'appreciat'],
      tags: { happiness: 2, love: 2, kindness: 2, respect: 2, honesty: 1, hope: 1 }, pin: [5, 36, 21, 45] }
  ];

  const TOPICS = [
    { id: 'discipline', en: 'Discipline', ar: 'الانضباط', cats: { discipline: 1 },
      tags: { discipline: 3, habits: 2, restraint: 2, focus: 1, action: 1 }, pin: [7, 27, 13, 47, 6] },
    { id: 'intelligence', en: 'Intelligence', ar: 'الذكاء', words: ['intelligen', 'smarter'],
      tags: { learning: 2, wisdom: 2, thinking: 2, understanding: 2, change: 2, knowledge: 2, questions: 1, mistakes: 1 }, pin: [57, 58, 38, 28, 26] },
    { id: 'learning', en: 'Learning', ar: 'التعلّم', cats: { learning: 1 },
      tags: { learning: 3, questions: 2, mistakes: 2, practice: 2, teaching: 2, knowledge: 2, curiosity: 2, study: 1 }, pin: [57, 58, 61, 26, 41] },
    { id: 'patience', en: 'Patience', ar: 'الصبر', words: ['patien'],
      tags: { restraint: 3, endurance: 3 }, pin: [56, 72] },
    { id: 'productivity', en: 'Productivity', ar: 'الإنتاجية', words: ['productive'],
      tags: { focus: 3, action: 3, habits: 2, priorities: 2, mornings: 2, phone: 2, order: 1 }, pin: [60, 6, 7, 13, 23, 17] },
    { id: 'success', en: 'Success', ar: 'النجاح', words: ['success'],
      tags: { success: 3, goals: 2, determination: 2, 'hard-work': 2, opportunity: 2, glory: 2, failure: 1, dreams: 1 }, pin: [40, 59, 53, 63, 30, 50] },
    { id: 'creativity', en: 'Creativity', ar: 'الإبداع', cats: { creativity: 1 }, words: ['creat'],
      tags: { creating: 3, making: 3, originality: 2, design: 2, passion: 1, dreams: 1 }, pin: [18, 1, 3, 21] },
    { id: 'work-ethic', en: 'Work ethic', ar: 'أخلاقيات العمل', words: ['work ethic', 'work hard'],
      tags: { 'hard-work': 3, determination: 3, work: 2, discipline: 1 }, pin: [59, 53, 45, 46] },
    { id: 'goal-achievement', en: 'Goal achievement', ar: 'تحقيق الأهداف', words: ['goal'],
      tags: { goals: 3, determination: 2, 'hard-work': 2, action: 1 }, pin: [63, 53, 11, 46, 32] },
    { id: 'personal-development', en: 'Personal development', ar: 'التطوير الشخصي', words: ['personal development'],
      tags: { growth: 3, skills: 2, knowledge: 2, 'self-awareness': 2, reflection: 2, change: 2, habits: 1, identity: 1 }, pin: [67, 25, 20, 34, 24] },
    { id: 'business', en: 'Business', ar: 'الأعمال', words: ['product', 'sell'],
      tags: { sales: 3, systems: 2, strategy: 2, 'problem-solving': 2, solutions: 1, originality: 1, skills: 1 }, pin: [66, 4, 9, 68] },
    { id: 'entrepreneurship', en: 'Entrepreneurship', ar: 'ريادة الأعمال', words: ['your own dream', 'sell'],
      tags: { dreams: 3, sales: 2, originality: 2, independence: 2, making: 2, opportunity: 2, creating: 1 }, pin: [43, 51, 68, 66, 50, 25] },
    { id: 'psychology', en: 'Psychology', ar: 'علم النفس',
      tags: { expectations: 3, 'self-awareness': 2, reflection: 2, feelings: 2, fear: 2, habits: 2, 'self-talk': 2, boundaries: 2, composure: 1, perspective: 1 }, pin: [19, 55, 12, 33, 16, 47, 76] },
    { id: 'perspective', en: 'Perspective', ar: 'زاوية النظر', words: ['perspective'],
      tags: { perspective: 3, thinking: 1 }, pin: [62, 70, 2, 33] },
    { id: 'self-control', en: 'Self-control', ar: 'ضبط النفس', words: ['self-control'],
      tags: { restraint: 3, habits: 2, composure: 2, discipline: 2, addiction: 2 }, pin: [65, 49, 47, 12, 56, 27] },
    { id: 'knowledge', en: 'Knowledge', ar: 'المعرفة', words: ['knowledge'],
      tags: { knowledge: 3, learning: 1, wisdom: 2, understanding: 1, curiosity: 2 }, pin: [15, 61, 67, 21] },
    { id: 'skills', en: 'Skills', ar: 'المهارات', words: ['skill'],
      tags: { skills: 3, mastery: 2, practice: 2, making: 1, independence: 1 }, pin: [25, 67, 68, 6, 41] },
    { id: 'decision-making', en: 'Decision-making', ar: 'اتخاذ القرار',
      tags: { choices: 3, priorities: 2, thinking: 2, wisdom: 1, strategy: 1, 'problem-solving': 1, 'self-awareness': 1 }, pin: [17, 49, 69, 54, 22, 63] },
    { id: 'integrity', en: 'Integrity', ar: 'النزاهة', words: ['integrity'],
      tags: { integrity: 3, honesty: 3, truth: 2, respect: 1, choices: 1 }, pin: [69, 11, 36, 5, 71] },
    { id: 'environment', en: 'Environment', ar: 'البيئة', words: ['environment', 'surround'],
      tags: { example: 2, boundaries: 1 }, pin: [67] }
  ];

  FEELINGS.forEach(function (o) { o._kind = 'feel'; });
  TOPICS.forEach(function (o) { o._kind = 'topic'; });
  const kindOf = { feel: FEELINGS, topic: TOPICS };
  function find(kind, id) { return (kindOf[kind] || []).filter(function (o) { return o.id === id; })[0] || null; }

  /** Score one quote for one option. */
  function score(option, q) {
    let s = 0;
    const tags = option.tags || {}, cats = option.cats || {};
    q.tags.forEach(function (t) { if (tags[t]) s += tags[t]; });
    q.categories.forEach(function (c) { if (cats[c]) s += cats[c]; });
    const hay = (' ' + q.title + ' ' + q.text).toLowerCase();
    (option.words || []).forEach(function (w) { if (hay.indexOf(' ' + w) !== -1 || hay.indexOf('"' + w) !== -1 || hay.indexOf('“' + w) !== -1) s += 2; });
    if ((option.pin || []).indexOf(q.number) !== -1) s += PIN_BONUS;
    // Added through the admin (or by hand): direct assignment, and tags that name the option or a synonym.
    const key = (option._kind || '') + ':' + option.id;
    if ((q.topics || []).indexOf(key) !== -1) s += ASSIGN_BONUS;
    const names = [slug(option.id), slug(option.en)].concat(SYNONYMS[option.id] || []);
    if (q.tags.some(function (t) { return names.indexOf(slug(t)) !== -1; })) s += NAME_BONUS;
    return s;
  }

  /** Every entry that genuinely belongs to an option: strongest first, no cap, no duplicates. */
  function recommend(quotes, option) {
    const seen = {};
    return quotes.map(function (q) { return { q: q, s: score(option, q) }; })
      .filter(function (x) { if (x.s < MIN_SCORE || seen[x.q.id]) return false; seen[x.q.id] = 1; return true; })
      .sort(function (a, b) { return b.s - a.s || a.q.number - b.q.number; })
      .map(function (x) { return x.q; });
  }

  /** Other options whose recommendations overlap most with this one (for "explore next"). */
  function related(quotes, kind, option, limit) {
    const mine = {};
    recommend(quotes, option).forEach(function (q) { mine[q.id] = 1; });
    const out = [];
    ['feel', 'topic'].forEach(function (k) {
      kindOf[k].forEach(function (o) {
        if (k === kind && o.id === option.id) return;
        const n = recommend(quotes, o).filter(function (q) { return mine[q.id]; }).length;
        if (n) out.push({ kind: k, option: o, n: n });
      });
    });
    out.sort(function (a, b) { return b.n - a.n; });
    return out.slice(0, limit || 4);
  }

  root.DISCOVER = { FEELINGS: FEELINGS, TOPICS: TOPICS, find: find, recommend: recommend, related: related, MIN_SCORE: MIN_SCORE, SYNONYMS: SYNONYMS, slug: slug };
})(typeof window !== 'undefined' ? window : globalThis);
