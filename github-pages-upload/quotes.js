/*
 * Little Wisdom — the single source of truth for all quote content.
 *
 * Titles and text are authoritative and must never be paraphrased.
 * Categories, tags and image keys are editorial metadata added for navigation.
 * `author` and `sourceUrl` are intentionally empty: no attribution was supplied,
 * and none is invented. Fill them in only with verified information.
 */
(function (root) {
  'use strict';

  const CATEGORIES = [
    { id: 'life',       name: 'Life & Growth',          blurb: 'Falling, rising, and becoming.' },
    { id: 'discipline', name: 'Discipline & Focus',     blurb: 'Doing what matters, ignoring the rest.' },
    { id: 'learning',   name: 'Learning & Wisdom',      blurb: 'Questions, mistakes, and understanding.' },
    { id: 'creativity', name: 'Creativity & Work',      blurb: 'Making things and building your own.' },
    { id: 'people',     name: 'People & Relationships', blurb: 'How we speak, listen, and expect.' },
    { id: 'time',       name: 'Time & Goals',           blurb: 'Where your hours go, and where they lead.' },
    { id: 'faith',      name: 'Faith & Perspective',    blurb: 'Trust, fear, and the long view.' }
  ];

  // Illustrations rotate through all seven scenes by quote number, so neighbouring quotes
  // never share a picture and every scene is used about equally. (Mapping by category
  // repeated the same scene across a whole row.) A record may still override `image`.
  const SCENE_ORDER = ['window', 'rain', 'desk', 'train', 'morning', 'night', 'season'];

  // [number, title, text, categories, tags]
  const RAW = [
    [1, `Be the Only One`, `Be the only one, not the best one.`, ['life', 'creativity'], ['identity', 'originality']],
    [2, `Enjoy the Difficult Times`, `Sometimes, you have to enjoy the difficult times.`, ['life'], ['resilience', 'perspective']],
    [3, `Passion`, `Passion is about what you hope to accomplish.`, ['creativity'], ['passion', 'purpose']],
    [4, `Selling`, `Selling is about problems and solutions.`, ['creativity'], ['sales', 'problem-solving']],
    [5, `Tell Them`, `If you see something beautiful in someone, tell them. And if you see something bad in someone, tell them.`, ['people'], ['honesty', 'kindness']],
    [6, `Do More of One Thing`, `Don't do more things. Do more of one thing.`, ['discipline'], ['focus', 'mastery']],
    [7, `Discipline and Focus`, `Discipline is doing what matters. Focus is ignoring what doesn't matter.`, ['discipline'], ['discipline', 'focus']],
    [8, `Fear and Faith`, `Fear is “What if?” Faith is “Even if.”`, ['faith'], ['fear', 'faith']],
    [9, `Why Isn't It Working?`, `Two reasons why it's not working: your system is broken, or your strategy is broken.`, ['discipline', 'creativity'], ['systems', 'strategy']],
    [10, `Organize Your Life`, `Nobody is coming to organize your life for you.`, ['life', 'discipline'], ['responsibility', 'order']],
    [11, `Avoid Shortcuts`, `Avoid shortcuts that destroy the goal.`, ['discipline', 'time'], ['integrity', 'goals']],
    [12, `Responding to Insults`, `1. Are you okay?\n2. Did you say that to upset me?\n3. Do you realize what that says about you?`, ['people'], ['composure', 'respect']],
    [13, `Just Do It`, `If it's good for you, just DO it.`, ['discipline'], ['action', 'habits']],
    [14, `Get Back Up`, `Life is about HOW we get back up after we fall.`, ['life'], ['resilience', 'failure']],
    [15, `Learn What You Don't Know`, `The goal is not learning everything. The goal is learning what you do not know.`, ['learning'], ['curiosity', 'knowledge']],
    [16, `The Unknown`, `“People are enemies of what they do not know.”`, ['people', 'learning'], ['fear', 'understanding']],
    [17, `Your Time Is Limited`, `Your time is limited. You have to decide where to spend your time. You have to say, “I will spend my time here,” or “I will not.”`, ['time'], ['priorities', 'time']],
    [18, `Start Creating`, `Switch from watching to creating.`, ['creativity'], ['creating', 'making']],
    [19, `Expectations`, `Most people don't disappoint you; you disappoint yourself by expecting more than they can give.`, ['people'], ['expectations', 'self-awareness']],
    [20, `Read Yourself`, `Read yourself.`, ['learning', 'life'], ['self-awareness', 'reflection']],
    [21, `Discover the Wisdom`, `Happiness is discovering the wisdom behind what Allah created, understanding how things work and their benefits, and finding ways to make them simpler, smarter, and more beautiful.`, ['faith', 'learning', 'creativity'], ['happiness', 'wisdom', 'design']],
    [22, `Spend Your Time Wisely`, `You will become great at the things you want to spend your time on.`, ['time', 'learning'], ['mastery', 'priorities']],
    [23, `Take Back Your Time`, `Wake up early = Your day feels twice as long!\n\nStay away from your phone = One hour feels like two!`, ['time', 'discipline'], ['habits', 'phone', 'mornings']],
    [24, `Watch Him`, `If you want to change something in your life\n\nWatch him.`, ['life'], ['change', 'example']],
    [25, `Build Your Skills`, `The more skills you have, the more humans will need you, and the less you will need humans.`, ['creativity', 'learning'], ['skills', 'independence']],
    [26, `Learn by Asking`, `To learn, you have to ask questions, make mistakes, and combine the data from what you are learning.`, ['learning'], ['questions', 'mistakes', 'learning']],
    [27, `Do What You Avoid`, `Wisdom is about doing what you do not want to do.`, ['discipline', 'learning'], ['discipline', 'wisdom']],
    [28, `Think Before Asking AI`, `First, ask yourself, “HOW CAN I make this task easy, smart, simple, and beautiful?” Then ask AI. Try to think first.`, ['learning', 'creativity'], ['ai', 'thinking']],
    [29, `Turn to Allah`, `Your feelings come from Allah, so Allah is the only one who can help you avoid and get through those feelings.`, ['faith'], ['feelings', 'trust']],
    [30, `Glory Takes Endurance`, `“He who seeks glory does not ask for comfort; the fires of glory demand someone who endures them.”`, ['discipline', 'life'], ['endurance', 'glory']],
    [31, `Speak So People Understand`, `“The strongest of people in mind and the purest of them in soul is the one who speaks to people according to the level of their understanding.”`, ['people', 'learning'], ['communication', 'understanding']],
    [32, `Start Where You Are`, `“The timing will never be just right. Start where you stand, and work with whatever tools you may have at your command, and better tools will be found as you go along.”`, ['time', 'life'], ['beginnings', 'action']],
    [33, `Let Them Think`, `Let them think what they want, because people only hear what they want to hear and think what they want to think.`, ['people'], ['boundaries', 'perspective']],
    [34, `The Truth Can Hurt`, `The truth will set you free, but first, it'll piss you off.`, ['life', 'people'], ['truth', 'growth']],
    [35, `Start Small`, `“Start messy. Start small.”`, ['time', 'creativity'], ['beginnings', 'action']],
    [36, `Care and Honesty`, `“No one jokes with you except the one who loves you, no one reproaches you except the one who cherishes you, and no one checks up on you except the one who truly loves you.”`, ['people'], ['love', 'honesty']],
    [37, `Better Days`, `“When life gets hard, it means something better is coming.”`, ['life', 'faith'], ['hope', 'hard-times']],
    [38, `Learn from Others`, `“Only a fool learns from his own mistakes. The wise man learns from the mistakes of others.”`, ['learning'], ['mistakes', 'wisdom']],
    [39, `Hard Times`, `“Hard times test you, not kill you.”`, ['life'], ['hard-times', 'resilience']],
    [40, `Success and Failure`, `“Success hugs you in private. Failure slaps you in public. That's life!”`, ['life'], ['success', 'failure']],
    [41, `Learn by Doing`, `Teach me, and I remember. Involve me, and I learn.`, ['learning'], ['teaching', 'practice']],
    [42, `Trust Allah`, `Remember, nothing is in your hands; everything is in Allah's hands.`, ['faith'], ['trust', 'surrender']],
    [43, `Build Your Own Dream`, `If you do not build your own dream, someone else will hire you to help build theirs.`, ['creativity', 'time'], ['dreams', 'work']],
    [44, `Ask to Understand`, `If you do not understand, ask questions to understand. Do not be stupid.`, ['learning'], ['questions', 'understanding']],
    [45, `Love What You Do`, `The only way to do great work is to love what you do.`, ['creativity'], ['love', 'work']],
    [46, `Find a Way`, `“If you really want to do something, you will find a way. If you don't, you will find an excuse.”`, ['discipline', 'time'], ['excuses', 'determination']],
    [47, `Use Your Free Time`, `“When you quit an addiction, the first thing you will face is thinking about it during your free time. If you kill the free time, you win!”`, ['discipline'], ['addiction', 'habits']],
    [48, `Look for Solutions`, `Look for solutions, not just answers.`, ['learning', 'creativity'], ['solutions', 'thinking']],
    [49, `Know When to Start and Stop`, `“We humans suffer from two major problems: the first is knowing when to start, and the second is knowing when to stop.”`, ['discipline', 'life'], ['beginnings', 'restraint']],
    [50, `Seize Opportunities`, `“Opportunities are created to be seized immediately.”`, ['time'], ['opportunity', 'action']],
    [51, `Build Your Own Dream`, `Don't be busy watching other humans make money and achieve their dreams through your time while you avoid your own hard work.`, ['creativity', 'time'], ['dreams', 'time']],
    [52, `Take Action`, `QUOTES WON'T WORK UNLESS YOU DO.`, ['discipline'], ['action', 'quotes']],
    [53, `Work Toward Your Goals`, `To achieve your goals, you have to study or work every single hour of the day that you aren't eating, praying, going to the gym, spending time with your friends, or attending class. If you work or study harder than everyone else, you can get what you want.`, ['time', 'discipline'], ['study', 'hard-work']],
    [54, `Live for Yourself`, `Are you living for you?`, ['life'], ['identity', 'choices']],
    [55, `Tell Yourself What You Need to Hear`, `Tell Yourself What You Need to Hear.`, ['life'], ['self-talk', 'identity']],
    [56, `Patience`, `Figuring out what to do in the meantime. Aka - doing anything besides the thing you're avoiding, including nothing at all.`, ['discipline', 'time'], ['restraint', 'action']],
    [57, `Intelligence`, `How fast you change what you do in the same situation.\nAka “rate of learning”.`, ['learning'], ['learning', 'change']],
    [58, `Learning`, `Same thing happens, you respond differently. “Same condition - new behavior”.`, ['learning'], ['learning', 'change']],
    [59, `Work Ethic`, `To work hard, think about the outcome instead of the pain.`, ['discipline'], ['hard-work', 'determination']],
    [60, `How to Be Productive`, `Don't do anything besides the task you set out to complete.`, ['discipline'], ['focus', 'action']],
    [61, `Learning`, `Connect new knowledge to something familiar or something you already know.`, ['learning'], ['learning', 'knowledge']],
    [62, `Framing`, `How you look at a situation changes how you experience it. Ask yourself: How can I make this situation amazing, smarter, easier, or more beneficial?`, ['faith'], ['perspective', 'thinking']],
    [63, `Goal Achievement`, `Ask yourself: What is the one thing I could do that would guarantee I fail to achieve my goal? Then flip it around and do the opposite to move toward success.`, ['time'], ['goals', 'thinking']],
    [64, `Understanding Instructions`, `“Understand the level of detail in the instructions.”`, ['learning'], ['understanding']],
    [65, `Faith and Self-Control`, `“When you feel the urge to do a bad habit, remember that this test comes from Allah. If He created this feeling to test me, then He is the only One who can help me go through it and break it.”`, ['faith'], ['faith', 'restraint', 'habits']],
    [66, `Product Value`, `Your product must be unique, meaning others cannot sell it; sticky, meaning people keep buying it over time; and expensive, meaning you can charge way more than it costs you to deliver it.`, ['creativity'], ['sales', 'originality']],
    [67, `Personal Development`, `Fill your bucket with:\n\nNumber 1: Knowledge — what you know.\nNumber 2: Skills — what you know how to do.\nNumber 3: Environment — the things that influence your behavior, including who and what you surround yourself with.`, ['life'], ['growth', 'knowledge', 'skills']],
    [68, `Productise Yourself`, `To “productise yourself” means to identify what you naturally do best and scale it into a product that the world and humans find valuable and helpful to use.`, ['creativity'], ['skills', 'making']],
    [69, `Integrity`, `“Stay straight, even if the wrong path is tempting.”`, ['life'], ['integrity', 'choices']],
    [70, `Perspective`, `“If you blow things out of proportion, they will grow; if you downplay them, they will shrink.”`, ['faith'], ['perspective', 'thinking']],
    [71, `Authenticity`, `“The wider the gap becomes between who you truly are and who you pretend to be, the more it will be filled with sadness, depression, and a sense of shame.”`, ['life'], ['identity', 'feelings']],
    [72, `Patience`, `“Be patient, and you'll get something high quality.”`, ['discipline', 'time'], ['restraint', 'endurance']],
    [73, `Learning`, `It about breaking it down what you want learn into smaller and smaller constituent parts so that you can get it into an understandable unit that you can change your behavior.`, ['learning'], ['learning', 'behavior', 'understanding', 'change', 'practice']],
    [74, `Observe the Behaviors`, `If someone can’t tell you what to do with either your mouth or your body they are not giving you clear directions to succeed\nObserve the behaviors .`, ['learning'], ['observation', 'behavior', 'understanding', 'learning', 'communication']],
    [75, `Don't copy someone else's plan or tips`, `"Try to build your own, even if it's messy and imperfect."\n"Pick the pieces that make sense for your life."\n"Put them together yourself."`, ['life', 'creativity'], ['originality', 'independence', 'identity', 'making', 'choices']],
    [76, `Understand WHY you feel an emotion`, `Insult: My self-image or sense of respect feels threatened.\nAnger: Something seems unfair, wrong, or against my boundaries.\nAnxiety: I feel uncertain about the future.\nStress: I have too many demands and not enough time, energy, skills, or support.\nFear: Something feels threatening.\nOverthinking: I keep analyzing what could happen and struggle to stop.`, ['life', 'learning'], ['feelings', 'self-awareness', 'reflection', 'understanding']],
    [77, `Life Is Beautiful`, `"Life is beautiful, but some people make it miserable."`, ['people', 'life'], ['perspective']],
    [78, `Think Before You Decide`, `"Before making any decision, consider your finances, religion, health, family, facts, and risks. All of these should be part of your equation."`, ['life'], ['choices', 'thinking', 'wisdom', 'priorities']],
    [79, `When You Feel Lonely`, `Go outside and observe what Allah has created. Discover the wisdom behind things, understand their purpose and benefits, and ask yourself:\n\nWhy did Allah create this?\nWhat benefits does it bring?\nHow does it work?\nHow could I improve it?\nWhat else could I use it for?`, ['faith', 'learning'], ['loneliness', 'curiosity', 'questions', 'wisdom', 'reflection']],
    [80, `Ten Years in Six Months`, `“Stop being patient and start asking yourself, how do I accomplish my 10-year plan in 6 months? You will probably fail but you will be a lot further ahead of the person who simply accepted it was going to take 10 years.”`, ['time', 'discipline'], ['goals', 'determination', 'action', 'hard-work', 'success']],
    [81, `Today Is a Gift`, `Yesterday is history, Tomorrow is a mystery, but Today is a gift, that is why it is called the Present.`, ['time', 'life'], ['gratitude', 'perspective', 'time']],
    [82, `Unique and Sticky`, `"Make your product unique so you can set your own price, and make it sticky enough that customers keep coming back."`, ['creativity'], ['sales', 'strategy', 'originality']]
  ];

  const QUOTES = RAW.map(function (r) {
    return {
      id: 'q' + String(r[0]).padStart(2, '0'),
      number: r[0],
      title: r[1],
      text: r[2],
      categories: r[3],
      tags: r[4],
      author: '',
      sourceUrl: '',
      image: SCENE_ORDER[(r[0] - 1) % SCENE_ORDER.length],
      published: true
    };
  });

  root.CATEGORIES = CATEGORIES;
  root.QUOTES = QUOTES;
})(typeof window !== 'undefined' ? window : globalThis);
