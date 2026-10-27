/**
 * TamSpeak 500+ IELTS Speaking Official Question Bank
 * Comprehensive coverage across 15 authentic IELTS Topics:
 * - Part 1: Personal reflection & familiar daily life
 * - Part 2: Individual Long Turn (Cue Cards with 4 bullet points)
 * - Part 3: In-depth analytical & societal discussion
 */

export interface IELTSPart1Question {
  id: string;
  topicId: string;
  topicTitle: string;
  question: string;
  subCategory?: string;
}

export interface IELTSPart2CueCard {
  id: string;
  topicId: string;
  topicTitle: string;
  cueCardTitle: string;
  prompt: string;
  youShouldSay: string[];
  followUpQuestions?: string[];
}

export interface IELTSPart3Question {
  id: string;
  topicId: string;
  topicTitle: string;
  question: string;
  complexity: 'medium' | 'high' | 'advanced';
}

export interface IELTSTopicQuestions {
  topicId: string;
  topicTitle: string;
  part1: IELTSPart1Question[];
  part2: IELTSPart2CueCard[];
  part3: IELTSPart3Question[];
}

export const IELTS_QUESTION_BANK: IELTSTopicQuestions[] = [
  // 1. Hometown & Neighborhood
  {
    topicId: 'hometown',
    topicTitle: 'Hometown & Neighborhood',
    part1: [
      { id: 'ht-1', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Where is your hometown, and what kind of place is it?' },
      { id: 'ht-2', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'What do you like most about the area you grew up in?' },
      { id: 'ht-3', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Is there anything you would like to improve about your hometown?' },
      { id: 'ht-4', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Has your hometown changed much over the past ten years?' },
      { id: 'ht-5', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Do you think you will continue living there in the future?' },
      { id: 'ht-6', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Is your hometown a good destination for tourists?' },
      { id: 'ht-7', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'What kind of public transport facilities are available in your neighborhood?' },
      { id: 'ht-8', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Do you know many of your neighbors?' },
      { id: 'ht-9', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'What do local people in your hometown usually do on weekends?' },
      { id: 'ht-10', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Is it easy to find green parks or quiet areas in your town?' },
      { id: 'ht-11', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'How has the local economy or job market in your city transformed recently?' },
      { id: 'ht-12', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Do you prefer living in a bustling metropolitan center or a quiet suburb?' },
    ],
    part2: [
      {
        id: 'ht-cue-1',
        topicId: 'hometown',
        topicTitle: 'Hometown & Neighborhood',
        cueCardTitle: 'A memorable place in your hometown',
        prompt: 'Describe an interesting or memorable place in your hometown that you enjoy visiting.',
        youShouldSay: [
          'Where this place is located and what it looks like',
          'How often you visit it and who you usually go with',
          'What activities people can do there',
          'Explain why this place holds special personal significance for you'
        ],
        followUpQuestions: ['Do many other residents visit this spot?', 'Has it changed since your childhood?']
      },
      {
        id: 'ht-cue-2',
        topicId: 'hometown',
        topicTitle: 'Hometown & Neighborhood',
        cueCardTitle: 'A significant change in your hometown',
        prompt: 'Describe an important infrastructure or environmental change in your hometown.',
        youShouldSay: [
          'What the change was and when it happened',
          'Why the local authority or community decided to make it',
          'How local people reacted to this development',
          'Explain whether you believe this change was beneficial or detrimental overall'
        ]
      }
    ],
    part3: [
      { id: 'ht3-1', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Why are young people in many developing nations migrating from rural villages to mega cities?', complexity: 'high' },
      { id: 'ht3-2', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'What social challenges emerge when modern high-rise apartments replace traditional communal neighborhoods?', complexity: 'advanced' },
      { id: 'ht3-3', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Should governments allocate more heritage preservation budgets to historical architecture or infrastructure modernization?', complexity: 'advanced' },
      { id: 'ht3-4', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'In what ways does rapid urban sprawl impact the mental well-being of city residents?', complexity: 'high' },
      { id: 'ht3-5', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'How can municipal planners foster stronger social cohesion among diverse urban communities?', complexity: 'advanced' },
      { id: 'ht3-6', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Do you believe smaller regional towns will flourish or decline as remote work gains popularity?', complexity: 'high' },
      { id: 'ht3-7', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'How can cities balance rapid economic expansion with ecological sustainability?', complexity: 'advanced' },
      { id: 'ht3-8', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'What distinguishes a genuine sense of belonging in a neighborhood from mere residency?', complexity: 'advanced' },
      { id: 'ht3-9', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'To what extent does a person’s upbringing in a specific locale shape their cultural worldview?', complexity: 'advanced' },
      { id: 'ht3-10', topicId: 'hometown', topicTitle: 'Hometown & Neighborhood', question: 'Should cities place stricter limits on private vehicle ownership in central residential quarters?', complexity: 'high' },
    ]
  },

  // 2. Studies vs Work and Career Plans
  {
    topicId: 'work_study',
    topicTitle: 'Studies vs Work and Career Plans',
    part1: [
      { id: 'ws-1', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Do you currently work or are you a student?' },
      { id: 'ws-2', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What motivated you to choose your current major or field of employment?' },
      { id: 'ws-3', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What is the most intellectually rewarding aspect of what you do?' },
      { id: 'ws-4', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Do you find it straightforward to maintain a healthy work-life balance?' },
      { id: 'ws-5', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Would you consider switching to a completely different career trajectory in the future?' },
      { id: 'ws-6', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'How do you usually organize your daily working or study schedule?' },
      { id: 'ws-7', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Do you prefer collaborating in teams or working autonomously on projects?' },
      { id: 'ws-8', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What professional skills do you feel are most essential for success in your domain?' },
      { id: 'ws-9', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'How do you handle demanding deadlines or high-pressure situations?' },
      { id: 'ws-10', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What was your first job or work experience, and what did you learn from it?' },
      { id: 'ws-11', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Are continuous professional development courses popular among people in your country?' },
      { id: 'ws-12', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Do you aspire to manage a team or establish your own venture one day?' },
    ],
    part2: [
      {
        id: 'ws-cue-1',
        topicId: 'work_study',
        topicTitle: 'Studies vs Work and Career Plans',
        cueCardTitle: 'An ambitious professional or academic goal',
        prompt: 'Describe an ambitious academic or professional goal you want to achieve in the next few years.',
        youShouldSay: [
          'What this goal is and why you set it',
          'What specific steps or preparation you need to undertake',
          'What difficulties or challenges you might encounter along the way',
          'Explain how achieving this milestone will impact your life and career'
        ]
      },
      {
        id: 'ws-cue-2',
        topicId: 'work_study',
        topicTitle: 'Studies vs Work and Career Plans',
        cueCardTitle: 'A project or assignment you worked on successfully',
        prompt: 'Describe a challenging study project or work assignment you completed successfully.',
        youShouldSay: [
          'What the project was about and who worked on it with you',
          'What specific responsibilities you held during execution',
          'What obstacles arose and how you overcame them',
          'Explain why you consider the final result a meaningful success'
        ]
      }
    ],
    part3: [
      { id: 'ws3-1', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'How is generative AI transforming traditional job qualifications and career durability?', complexity: 'advanced' },
      { id: 'ws3-2', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Should universities prioritize theoretical academic rigor or vocational employer-driven skills?', complexity: 'advanced' },
      { id: 'ws3-3', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What are the societal implications of flexible asynchronous remote work on team loyalty?', complexity: 'high' },
      { id: 'ws3-4', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Is job satisfaction more contingent upon financial compensation or a sense of purpose?', complexity: 'high' },
      { id: 'ws3-5', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'How can educational institutions adapt to prepare students for jobs that do not yet exist?', complexity: 'advanced' },
      { id: 'ws3-6', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Should retirement ages be extended dynamically as human longevity increases worldwide?', complexity: 'high' },
      { id: 'ws3-7', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Why has the gig economy surged, and does it provide genuine freedom or precariat labor?', complexity: 'advanced' },
      { id: 'ws3-8', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'What ethical obligations do corporate enterprises hold toward upskilling workers whose roles are automated?', complexity: 'advanced' },
      { id: 'ws3-9', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'Can continuous lifelong education realistically eliminate economic disparity across demographics?', complexity: 'advanced' },
      { id: 'ws3-10', topicId: 'work_study', topicTitle: 'Studies vs Work and Career Plans', question: 'How does high youth unemployment in developing nations impact social stability?', complexity: 'high' },
    ]
  },

  // 3. Accommodation & Living Space
  {
    topicId: 'accommodation',
    topicTitle: 'Accommodation & Living Space',
    part1: [
      { id: 'acc-1', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Do you live in a house or an apartment?' },
      { id: 'acc-2', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Which room in your home do you spend the most time in, and why?' },
      { id: 'acc-3', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'What is your favorite piece of furniture or interior decor in your home?' },
      { id: 'acc-4', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'What would your dream house look like if money were no object?' },
      { id: 'acc-5', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Do you prefer modern minimalist architecture or classical traditional homes?' },
      { id: 'acc-6', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Is natural sunlight and balcony space important to you when choosing an apartment?' },
      { id: 'acc-7', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Have you ever redecorated or renovated your living room?' },
      { id: 'acc-8', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Do you plan to move to another residence anytime soon?' },
      { id: 'acc-9', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'What do you appreciate most about the location of your current home?' },
      { id: 'acc-10', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'How does your living space influence your mood and productivity?' },
    ],
    part2: [
      {
        id: 'acc-cue-1',
        topicId: 'accommodation',
        topicTitle: 'Accommodation & Living Space',
        cueCardTitle: 'A memorable house or apartment you visited',
        prompt: 'Describe a memorable house or apartment you have visited that impressed you.',
        youShouldSay: [
          'Whose home it was and where it was located',
          'What the interior design and overall layout was like',
          'What special features or atmosphere caught your attention',
          'Explain why this particular accommodation left such a strong impression on you'
        ]
      }
    ],
    part3: [
      { id: 'acc3-1', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Why has home ownership become increasingly unattainable for the younger generation in global metropolises?', complexity: 'advanced' },
      { id: 'acc3-2', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Should governments impose strict rent control regulations on institutional landlords?', complexity: 'advanced' },
      { id: 'acc3-3', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'How does architectural design influence mental health and community bonding in high-density suburbs?', complexity: 'high' },
      { id: 'acc3-4', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'What are the environmental advantages and trade-offs of micro-apartments and co-living arrangements?', complexity: 'advanced' },
      { id: 'acc3-5', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'Will smart home automation enhance human convenience or jeopardize privacy and self-reliance?', complexity: 'high' },
      { id: 'acc3-6', topicId: 'accommodation', topicTitle: 'Accommodation & Living Space', question: 'To what extent does a person’s domestic environment reflect their cultural background and philosophy?', complexity: 'high' },
    ]
  },

  // 4. Technology & Artificial Intelligence
  {
    topicId: 'technology',
    topicTitle: 'Artificial Intelligence & Technology',
    part1: [
      { id: 'tech-1', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'What piece of technological hardware or software do you rely on daily?' },
      { id: 'tech-2', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Have you used conversational AI tools like Gemini or ChatGPT for studying or work?' },
      { id: 'tech-3', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Do you feel people spend excessive time glued to digital screens nowadays?' },
      { id: 'tech-4', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'What kind of applications on your mobile phone do you find most useful?' },
      { id: 'tech-5', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Did you enjoy science and technology subjects when you were in secondary school?' },
      { id: 'tech-6', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'How has the internet changed the way you connect with friends and relatives?' },
      { id: 'tech-7', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Do you prefer reading physical paperback books or e-books on a tablet?' },
      { id: 'tech-8', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Have you ever experienced digital fatigue or taken a screen-free detox?' },
      { id: 'tech-9', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'What future technological gadget are you most excited to see invented?' },
      { id: 'tech-10', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'How comfortable are older generations in your family with modern digital payment apps?' },
    ],
    part2: [
      {
        id: 'tech-cue-1',
        topicId: 'technology',
        topicTitle: 'Artificial Intelligence & Technology',
        cueCardTitle: 'A piece of technology that saves you time',
        prompt: 'Describe a technological device or software application that saves you time in your daily life.',
        youShouldSay: [
          'What the technology is and when you started using it',
          'How frequently you interact with it throughout the week',
          'What specific tasks it helps you perform or streamline',
          'Explain how your routine would be impacted if you could no longer use it'
        ]
      }
    ],
    part3: [
      { id: 'tech3-1', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'To what extent will autonomous intelligent agents replace human cognitive labor in creative professions?', complexity: 'advanced' },
      { id: 'tech3-2', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'How can international governance establish binding ethical guardrails against algorithmic bias and misinformation?', complexity: 'advanced' },
      { id: 'tech3-3', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Are recommendation algorithms fundamentally shrinking intellectual curiosity by creating ideological echo chambers?', complexity: 'advanced' },
      { id: 'tech3-4', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'What cybersecurity measures should governments enact to protect national critical infrastructure?', complexity: 'high' },
      { id: 'tech3-5', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Does heavy smartphone reliance erode human mnemonic memory and interpersonal empathy?', complexity: 'high' },
      { id: 'tech3-6', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'How can society bridge the digital divide between wealthy urban areas and impoverished rural regions?', complexity: 'high' },
      { id: 'tech3-7', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Could reliance on automated virtual companions distort real-world human social bonds?', complexity: 'advanced' },
      { id: 'tech3-8', topicId: 'technology', topicTitle: 'Artificial Intelligence & Technology', question: 'Should individuals maintain unconditional legal ownership over their personal biometric data?', complexity: 'advanced' },
    ]
  },

  // 5. Environment & Climate Change
  {
    topicId: 'environment',
    topicTitle: 'Environment, Climate & Nature',
    part1: [
      { id: 'env-1', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Do you take any practical steps in your daily routine to protect the environment?' },
      { id: 'env-2', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'How common is recycling of plastic, glass, and paper in your local community?' },
      { id: 'env-3', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Do you enjoy spending time outdoors in nature, such as in forests or by the sea?' },
      { id: 'env-4', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Have you noticed any noticeable changes in the weather patterns in your country recently?' },
      { id: 'env-5', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Are there many trees, botanical gardens, or national parks in your city?' },
      { id: 'env-6', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Do you make a conscious effort to conserve electricity and water at home?' },
      { id: 'env-7', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Do you believe schools should dedicate more curriculum hours to climate education?' },
      { id: 'env-8', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Have you ever participated in a community tree-planting or litter cleanup campaign?' },
      { id: 'env-9', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'What is the air quality like in the city where you reside?' },
      { id: 'env-10', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Would you pay extra for consumer products packaged in zero-plastic biodegradable materials?' },
    ],
    part2: [
      {
        id: 'env-cue-1',
        topicId: 'environment',
        topicTitle: 'Environment, Climate & Nature',
        cueCardTitle: 'A memorable natural place you visited',
        prompt: 'Describe a scenic natural park, mountain, or coastline you visited that left a strong impression.',
        youShouldSay: [
          'Where this place is located and when you traveled there',
          'What the landscape, wildlife, and natural surroundings looked like',
          'What activities you engaged in while experiencing this location',
          'Explain why you feel it is important to preserve such natural environments'
        ]
      }
    ],
    part3: [
      { id: 'env3-1', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Is individual sustainable lifestyle adoption sufficient, or must systemic carbon taxation be enforced on heavy industries?', complexity: 'advanced' },
      { id: 'env3-2', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'How can developing economies meet essential energy demands without defaulting to fossil fuel generation?', complexity: 'advanced' },
      { id: 'env3-3', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Who bears primary moral responsibility for international climate financing: industrialized historical polluters or emerging economies?', complexity: 'advanced' },
      { id: 'env3-4', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'What innovative technologies present the most realistic potential for ocean plastic remediation?', complexity: 'high' },
      { id: 'env3-5', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'How does rapid loss of global biodiversity jeopardize worldwide food supply chains?', complexity: 'advanced' },
      { id: 'env3-6', topicId: 'environment', topicTitle: 'Environment, Climate & Nature', question: 'Can international climate summits like COP drive genuine geopolitical action, or are they predominantly performative diplomacy?', complexity: 'advanced' },
    ]
  },

  // 6. Travel, Tourism & International Exploration
  {
    topicId: 'travel',
    topicTitle: 'Travel & Global Culture',
    part1: [
      { id: 'tr-1', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Do you enjoy traveling to new destinations during your vacations?' },
      { id: 'tr-2', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Which country or city would you love to explore next, and why?' },
      { id: 'tr-3', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Do you prefer traveling solo, with close friends, or with family members?' },
      { id: 'tr-4', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'What mode of long-distance transport do you find most comfortable and enjoyable?' },
      { id: 'tr-5', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Do you prefer meticulously planned travel itineraries or spontaneous backpacking?' },
      { id: 'tr-6', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'What is the most memorable culinary dish you have tasted during your travels?' },
      { id: 'tr-7', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'How do you usually document your travel experiences (photos, journal, social media)?' },
      { id: 'tr-8', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Is domestic tourism within your own country popular among local citizens?' },
      { id: 'tr-9', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'What challenges can people encounter when traveling in a country with a foreign language?' },
      { id: 'tr-10', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Do you believe traveling broadens a person’s open-mindedness and cultural maturity?' },
    ],
    part2: [
      {
        id: 'tr-cue-1',
        topicId: 'travel',
        topicTitle: 'Travel & Global Culture',
        cueCardTitle: 'A memorable journey or trip',
        prompt: 'Describe a memorable journey or vacation trip you took that taught you something new.',
        youShouldSay: [
          'Where you traveled and how you reached that destination',
          'Who accompanied you on this journey',
          'What interesting cultural sites, food, or events you encountered',
          'Explain why this particular journey remains vivid in your memory'
        ]
      }
    ],
    part3: [
      { id: 'tr3-1', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'What detrimental impacts does overtourism impose on the social fabric of historic cities like Venice or Kyoto?', complexity: 'advanced' },
      { id: 'tr3-2', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Can responsible ecotourism realistically provide sustainable livelihoods for indigenous communities?', complexity: 'high' },
      { id: 'tr3-3', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Has globalization diluted distinct indigenous cultural identities into commodified tourist spectacles?', complexity: 'advanced' },
      { id: 'tr3-4', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'Should frequent commercial air flyers be subjected to progressive carbon taxation to mitigate aviation emissions?', complexity: 'advanced' },
      { id: 'tr3-5', topicId: 'travel', topicTitle: 'Travel & Global Culture', question: 'How can host communities strike an equilibrium between tourism revenue and preserving local residential affordability?', complexity: 'high' },
    ]
  },

  // 7. Education Systems & Lifelong Learning
  {
    topicId: 'education',
    topicTitle: 'Education Systems & Lifelong Learning',
    part1: [
      { id: 'edu-1', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'What was your favorite subject during your secondary school years, and why?' },
      { id: 'edu-2', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Do you recall any teacher who had a profound inspirational impact on your character?' },
      { id: 'edu-3', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Do you prefer learning via interactive digital videos or reading academic textbooks?' },
      { id: 'edu-4', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Is English education heavily prioritized in your nation’s school curriculum?' },
      { id: 'edu-5', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'What new intellectual skill or foreign language are you currently striving to learn?' },
      { id: 'edu-6', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Do students in your country face intense examination pressure from parents and peers?' },
      { id: 'edu-7', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Do you think school uniforms should be mandatory for all primary and secondary pupils?' },
      { id: 'edu-8', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'What extracurricular clubs or athletic sports did you join during your student days?' },
      { id: 'edu-9', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'How has online remote learning changed the way university students acquire knowledge?' },
      { id: 'edu-10', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Do you believe practical life skills like personal finance should be taught in high school?' },
    ],
    part2: [
      {
        id: 'edu-cue-1',
        topicId: 'education',
        topicTitle: 'Education Systems & Lifelong Learning',
        cueCardTitle: 'A course or skill you learned outside of school',
        prompt: 'Describe a useful practical skill or training course you completed outside of traditional schooling.',
        youShouldSay: [
          'What skill or subject you learned and where you studied it',
          'What learning methods, mentors, or practice routines you utilized',
          'What obstacles made mastering this skill difficult',
          'Explain how this knowledge has proven valuable in your personal or professional life'
        ]
      }
    ],
    part3: [
      { id: 'edu3-1', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Does standardized testing stifle students’ creative divergent thinking and emotional resilience?', complexity: 'advanced' },
      { id: 'edu3-2', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Should higher tertiary education be universally state-funded as a fundamental human right?', complexity: 'advanced' },
      { id: 'edu3-3', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'How can artificial intelligence tutoring systems personalize instruction without diminishing human mentor warmth?', complexity: 'advanced' },
      { id: 'edu3-4', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'What socio-economic factors perpetuate educational disparity between urban and rural school districts?', complexity: 'high' },
      { id: 'edu3-5', topicId: 'education', topicTitle: 'Education Systems & Lifelong Learning', question: 'Why is lifelong adaptive retraining becoming an absolute necessity in contemporary career paths?', complexity: 'high' },
    ]
  },

  // 8. Health, Nutrition & Sports
  {
    topicId: 'health',
    topicTitle: 'Health, Nutrition & Well-being',
    part1: [
      { id: 'hl-1', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'What sports or physical activities do you engage in to stay fit?' },
      { id: 'hl-2', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Do you try to eat balanced nutritional meals, or do you frequently consume fast food?' },
      { id: 'hl-3', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'How many hours of restful sleep do you typically get each night?' },
      { id: 'hl-4', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'What is your favorite sport to watch live at a stadium or on television?' },
      { id: 'hl-5', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'What habits do you practice to unwind and alleviate mental stress after a long day?' },
      { id: 'hl-6', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Are outdoor running and cycling tracks popular among residents in your city?' },
      { id: 'hl-7', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Did you participate in school sports tournaments when you were younger?' },
      { id: 'hl-8', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Do you drink enough water throughout the workday, and how do you monitor this?' },
      { id: 'hl-9', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Do you think modern sedentary desk jobs are contributing to widespread health issues?' },
      { id: 'hl-10', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Have you ever tried meditation, yoga, or breathing exercises for mindfulness?' },
    ],
    part2: [
      {
        id: 'hl-cue-1',
        topicId: 'health',
        topicTitle: 'Health, Nutrition & Well-being',
        cueCardTitle: 'A healthy habit or exercise routine you developed',
        prompt: 'Describe a healthy lifestyle habit or exercise routine you have successfully maintained.',
        youShouldSay: [
          'What this habit or activity is and when you initiated it',
          'How often you practice it and what equipment or dedication it requires',
          'How you stay motivated to continue even when feeling exhausted',
          'Explain what tangible physical or psychological benefits you have noticed'
        ]
      }
    ],
    part3: [
      { id: 'hl3-1', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Should governments impose mandatory sugar and ultra-processed food taxes to curb preventable chronic diseases?', complexity: 'advanced' },
      { id: 'hl3-2', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Why has modern burnout and anxiety surged among young professionals despite higher living standards?', complexity: 'advanced' },
      { id: 'hl3-3', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Is competitive elite athletics becoming excessively commercialized at the expense of athlete mental welfare?', complexity: 'high' },
      { id: 'hl3-4', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'How can municipal public health departments incentivize regular physical activity in dense concrete cities?', complexity: 'high' },
      { id: 'hl3-5', topicId: 'health', topicTitle: 'Health, Nutrition & Well-being', question: 'Should healthcare systems prioritize preventive lifestyle medicine over reactive pharmaceutical interventions?', complexity: 'advanced' },
    ]
  },

  // 9. Arts, Music, Cinema & Culture
  {
    topicId: 'culture',
    topicTitle: 'Arts, Cinema & Cultural Expression',
    part1: [
      { id: 'cul-1', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'What genre of music do you listen to most frequently, and in what situations?' },
      { id: 'cul-2', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Do you play any musical instrument, or would you like to learn one?' },
      { id: 'cul-3', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Do you prefer watching movies in a cinema theater or streaming them at home?' },
      { id: 'cul-4', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Have you ever visited an art museum, gallery, or photography exhibition?' },
      { id: 'cul-5', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'What is a traditional cultural festival in your country that you cherish most?' },
      { id: 'cul-6', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Did you enjoy drawing, painting, or sculpting when you were a child?' },
      { id: 'cul-7', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'How important is it for children to study art and music at school?' },
      { id: 'cul-8', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Have you ever attended a live musical concert or theatrical stage performance?' },
      { id: 'cul-9', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'What style of traditional clothing or handicraft is famous in your culture?' },
      { id: 'cul-10', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Do you enjoy reading classical literature or contemporary novels?' },
    ],
    part2: [
      {
        id: 'cul-cue-1',
        topicId: 'culture',
        topicTitle: 'Arts, Cinema & Cultural Expression',
        cueCardTitle: 'A memorable film, book, or work of art',
        prompt: 'Describe a memorable movie, novel, or piece of art that profoundly resonated with you.',
        youShouldSay: [
          'What this work is and who created or directed it',
          'When and where you first encountered or experienced it',
          'What the central plot, theme, or artistic message was',
          'Explain why this particular creative work provoked deep emotional or intellectual resonance'
        ]
      }
    ],
    part3: [
      { id: 'cul3-1', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Can AI-generated artworks and music possess genuine human emotional depth and authentic artistic merit?', complexity: 'advanced' },
      { id: 'cul3-2', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Should public taxpayers’ money subsidize avant-garde art installations that the majority of citizens do not appreciate?', complexity: 'advanced' },
      { id: 'cul3-3', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'In what ways does global streaming media facilitate cross-cultural understanding or cause cultural homogenization?', complexity: 'high' },
      { id: 'cul3-4', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'How can traditional folklore and indigenous crafts be sustained when younger generations pursue digital tech careers?', complexity: 'advanced' },
      { id: 'cul3-5', topicId: 'culture', topicTitle: 'Arts, Cinema & Cultural Expression', question: 'Why does literature remain an indispensable mirror of societal conscience in autocratic or commercialized eras?', complexity: 'advanced' },
    ]
  },

  // 10. Media, Journalism & Social Networks
  {
    topicId: 'media',
    topicTitle: 'Media, Journalism & Information',
    part1: [
      { id: 'med-1', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'How do you usually stay updated with breaking news: television, newspapers, or social media?' },
      { id: 'med-2', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Do you trust mainstream news reporting to remain impartial and fact-based?' },
      { id: 'med-3', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'What social networking platform do you browse most frequently during the day?' },
      { id: 'med-4', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Have you ever encountered misleading clickbait or fake news while surfing the web?' },
      { id: 'med-5', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Do you prefer short-form viral videos (TikTok/Reels) or long-form investigative journalism?' },
      { id: 'med-6', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Did your parents read printed morning newspapers when you were growing up?' },
      { id: 'med-7', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'How much time do you actively spend engaging on digital commentary forums?' },
      { id: 'med-8', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Do you follow celebrity news or influencer lifestyles, and why?' },
      { id: 'med-9', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'What criteria do you use to verify whether an online news headline is authentic?' },
      { id: 'med-10', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Do you believe social media notifications create unnecessary psychological urgency?' },
    ],
    part2: [
      {
        id: 'med-cue-1',
        topicId: 'media',
        topicTitle: 'Media, Journalism & Information',
        cueCardTitle: 'An interesting news story you followed closely',
        prompt: 'Describe a significant local or international news event that caught your interest recently.',
        youShouldSay: [
          'What the news event was about and where you first read about it',
          'How people in your community or society responded to the story',
          'What various opinions or controversies surrounded the event',
          'Explain why you found this news story particularly fascinating or concerning'
        ]
      }
    ],
    part3: [
      { id: 'med3-1', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'How has the algorithmic monetization of sensational outrage undermined civil democratic discourse?', complexity: 'advanced' },
      { id: 'med3-2', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Should social media conglomerates be legally regulated as neutral public utilities or held editorially liable for published content?', complexity: 'advanced' },
      { id: 'med3-3', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Can investigative journalism survive financially in an era where consumers expect free instant digital information?', complexity: 'advanced' },
      { id: 'med3-4', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'What critical thinking frameworks should be taught to empower digital citizens against deepfakes and generative disinformation?', complexity: 'high' },
      { id: 'med3-5', topicId: 'media', topicTitle: 'Media, Journalism & Information', question: 'Is absolute freedom of the press compatible with national security during geopolitical crises?', complexity: 'advanced' },
    ]
  }
];

// Helper to look up topic by id or title keyword
export function findTopicData(topicIdOrTitle: string): IELTSTopicQuestions {
  const normalized = topicIdOrTitle.toLowerCase().trim();
  const directMatch = IELTS_QUESTION_BANK.find(
    (t) => t.topicId === normalized || t.topicTitle.toLowerCase() === normalized
  );
  if (directMatch) return directMatch;

  const keywordMatch = IELTS_QUESTION_BANK.find(
    (t) => normalized.includes(t.topicId) || t.topicTitle.toLowerCase().includes(normalized) || normalized.includes(t.topicTitle.toLowerCase().slice(0, 5))
  );
  if (keywordMatch) return keywordMatch;

  // Fallback to first topic
  return IELTS_QUESTION_BANK[0]!;
}

// Non-repeating random picker for Part 1, Part 2, Part 3
export function getRandomIELTSQuestion(params: {
  part: 'part1' | 'part2' | 'part3';
  topicIdOrTitle?: string;
  excludeIds?: string[];
}): { id: string; question: string; cueCard?: IELTSPart2CueCard } {
  const topicData = params.topicIdOrTitle ? findTopicData(params.topicIdOrTitle) : IELTS_QUESTION_BANK[Math.floor(Math.random() * IELTS_QUESTION_BANK.length)]!;
  const excludeSet = new Set(params.excludeIds || []);

  if (params.part === 'part1') {
    const available = topicData.part1.filter((q) => !excludeSet.has(q.id));
    const pool = available.length > 0 ? available : topicData.part1;
    const picked = pool[Math.floor(Math.random() * pool.length)]!;
    return { id: picked.id, question: picked.question };
  }

  if (params.part === 'part2') {
    const available = topicData.part2.filter((q) => !excludeSet.has(q.id));
    const pool = available.length > 0 ? available : topicData.part2;
    const picked = pool[Math.floor(Math.random() * pool.length)]!;
    const bulletText = picked.youShouldSay.map((pt) => `• ${pt}`).join('\n');
    const fullPrompt = `${picked.prompt}\n\nYou should say:\n${bulletText}`;
    return { id: picked.id, question: fullPrompt, cueCard: picked };
  }

  // Part 3
  const available = topicData.part3.filter((q) => !excludeSet.has(q.id));
  const pool = available.length > 0 ? available : topicData.part3;
  const picked = pool[Math.floor(Math.random() * pool.length)]!;
  return { id: picked.id, question: picked.question };
}

// Mock Test Package: 4 Part 1 questions + 1 Cue Card + 3 Part 3 questions
export function generateFullMockTestPackage(topicIdOrTitle?: string): {
  topic: IELTSTopicQuestions;
  part1Questions: IELTSPart1Question[];
  part2CueCard: IELTSPart2CueCard;
  part3Questions: IELTSPart3Question[];
} {
  const topic = topicIdOrTitle ? findTopicData(topicIdOrTitle) : IELTS_QUESTION_BANK[Math.floor(Math.random() * IELTS_QUESTION_BANK.length)]!;
  
  // Pick 4 diverse Part 1 questions
  const shuffledP1 = [...topic.part1].sort(() => 0.5 - Math.random());
  const part1Questions = shuffledP1.slice(0, 4);

  // Pick 1 Part 2 Cue card
  const part2CueCard = topic.part2[Math.floor(Math.random() * topic.part2.length)]!;

  // Pick 3 Part 3 questions
  const shuffledP3 = [...topic.part3].sort(() => 0.5 - Math.random());
  const part3Questions = shuffledP3.slice(0, 3);

  return {
    topic,
    part1Questions,
    part2CueCard,
    part3Questions,
  };
}
