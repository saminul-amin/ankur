export type EvaluationLanguage = "bn" | "en" | "mixed";
export type EvaluationInputType =
  | "pasted_text"
  | "digital_pdf"
  | "page_image"
  | "mixed_pdf";

export interface EvaluationCorpusPage {
  readonly pageNumber: number;
  readonly route: "pasted_text" | "embedded_text" | "page_transcription";
  readonly text: string;
}

export interface EvaluationCorpusMaterial {
  readonly id: string;
  readonly title: string;
  readonly domain: "academic_science" | "bangladesh_civics" | "vocational_safety";
  readonly language: EvaluationLanguage;
  readonly inputType: EvaluationInputType;
  readonly fixturePath: string | null;
  readonly pages: readonly EvaluationCorpusPage[];
  readonly learnerPriority: string;
  readonly licence: "CC-BY-4.0";
  readonly provenance: "team-authored";
  readonly publicSafe: true;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const dates = {
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
} as const;

export const evaluationCorpus: readonly EvaluationCorpusMaterial[] = [
  {
    id: "SCI-BN-PASTE-01",
    title: "জলচক্রে শক্তি ও পদার্থের চলাচল",
    domain: "academic_science",
    language: "bn",
    inputType: "pasted_text",
    fixturePath: null,
    learnerPriority: "বাষ্পীভবন, ঘনীভবন ও বৃষ্টিপাতের ধারাবাহিক সম্পর্ক বুঝতে চাই।",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "pasted_text",
        text: "সূর্যের তাপে নদী, পুকুর ও সমুদ্রের পানি বাষ্পে পরিণত হয়ে উপরে ওঠে। এই পরিবর্তনকে বাষ্পীভবন বলে। গাছের পাতাও বাষ্পমোচনের মাধ্যমে বাতাসে জলীয় বাষ্প যোগ করে।\n\nউঁচু স্তরে বাতাস ঠান্ডা হলে জলীয় বাষ্প ক্ষুদ্র জলকণায় ঘনীভূত হয় এবং মেঘ তৈরি করে। জলকণাগুলো ভারী হলে বৃষ্টি হিসেবে নেমে আসে। বৃষ্টির পানি মাটিতে শোষিত হয় অথবা নদী দিয়ে আবার সমুদ্রে ফিরে যায়। তাই জলচক্রে পানি বারবার স্থান ও অবস্থা পরিবর্তন করলেও মোট পদার্থের ধারাবাহিক চলাচল বজায় থাকে।",
      },
    ],
  },
  {
    id: "SCI-EN-PDF-01",
    title: "Heat Transfer in Everyday Systems",
    domain: "academic_science",
    language: "en",
    inputType: "digital_pdf",
    fixturePath: "evaluation/corpus/public/fixtures/SCI-EN-PDF-01.pdf",
    learnerPriority: "Distinguish conduction, convection, and radiation using the examples.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "embedded_text",
        text: "Heat moves from a warmer region to a cooler region. Conduction transfers thermal energy through direct contact between particles. A metal spoon becomes warm when its tip remains in hot soup because energy passes through the metal.",
      },
      {
        pageNumber: 2,
        route: "embedded_text",
        text: "Convection transfers energy through the movement of a fluid. Warm water rises while cooler water sinks, creating a circulating current. Radiation transfers energy by electromagnetic waves and does not require matter; sunlight can therefore warm Earth through space.",
      },
    ],
  },
  {
    id: "CIV-BN-IMG-01",
    title: "ঘূর্ণিঝড়ের আগে স্থানীয় প্রস্তুতি",
    domain: "bangladesh_civics",
    language: "bn",
    inputType: "page_image",
    fixturePath: "evaluation/corpus/public/fixtures/CIV-BN-IMG-01.png",
    learnerPriority: "সতর্কসংকেত পাওয়ার পর পরিবারের করণীয়গুলো অগ্রাধিকার অনুযায়ী বুঝতে চাই।",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "page_transcription",
        text: "ঘূর্ণিঝড়ের সতর্কসংকেত পাওয়ার পর পরিবারের সবাইকে তথ্যটি জানাতে হবে। নিরাপদ আশ্রয়কেন্দ্রের অবস্থান ও যাওয়ার পথ আগে থেকে ঠিক করা জরুরি। শুকনা খাবার, বিশুদ্ধ পানি, প্রয়োজনীয় ওষুধ, টর্চ ও রেডিও জলরোধী ব্যাগে রাখতে হবে।\n\nস্থানীয় কর্তৃপক্ষ সরিয়ে নেওয়ার নির্দেশ দিলে দেরি না করে আশ্রয়কেন্দ্রে যেতে হবে। শিশু, বয়স্ক ব্যক্তি ও প্রতিবন্ধী সদস্যকে সহায়তায় অগ্রাধিকার দিতে হবে। গুজবের বদলে সরকারি বার্তা ও স্বীকৃত স্বেচ্ছাসেবকের নির্দেশ অনুসরণ করতে হবে।",
      },
    ],
  },
  {
    id: "CIV-MIX-PDF-01",
    title: "Community Flood Readiness / বন্যা প্রস্তুতি",
    domain: "bangladesh_civics",
    language: "mixed",
    inputType: "mixed_pdf",
    fixturePath: "evaluation/corpus/public/fixtures/CIV-MIX-PDF-01.pdf",
    learnerPriority: "Connect the household checklist with the Bengali evacuation guidance.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "embedded_text",
        text: "A household flood plan should identify a safe destination, two contact methods, and a route that avoids fast-moving water. Important documents and medicines should be stored in a waterproof container.",
      },
      {
        pageNumber: 2,
        route: "page_transcription",
        text: "পানি দ্রুত বাড়লে নিচু রাস্তা ব্যবহার করা যাবে না। বিদ্যুতের সংযোগ বিচ্ছিন্ন করার কাজ কেবল নিরাপদ অবস্থায় করতে হবে। শিশু ও বয়স্ক সদস্যকে আগে সরিয়ে নিতে হবে এবং স্থানীয় সতর্কবার্তা অনুসরণ করতে হবে।",
      },
      {
        pageNumber: 3,
        route: "embedded_text",
        text: "After reaching safety, the family should report its location to the agreed contact and wait for an official all-clear before returning. Floodwater may hide open drains, sharp objects, or damaged electrical lines.",
      },
    ],
  },
  {
    id: "VOC-EN-PASTE-01",
    title: "A Lockout Checklist for Small Workshops",
    domain: "vocational_safety",
    language: "en",
    inputType: "pasted_text",
    fixturePath: null,
    learnerPriority: "Remember the safe order before maintenance begins.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "pasted_text",
        text: "Before maintaining a powered machine, the worker should identify every energy source and tell affected coworkers that the equipment will be stopped. The normal control is used to shut the machine down before its energy-isolating device is operated.\n\nA personal lock and a clear tag are then applied to the isolating device. Stored energy, such as pressure in a line or tension in a spring, must be released or restrained. The worker verifies isolation by attempting a normal start, then returns the control to the off position. Only after these steps may maintenance begin.",
      },
    ],
  },
  {
    id: "VOC-MIX-IMG-01",
    title: "Workshop Chemical Labels / রাসায়নিক লেবেল",
    domain: "vocational_safety",
    language: "mixed",
    inputType: "page_image",
    fixturePath: "evaluation/corpus/public/fixtures/VOC-MIX-IMG-01.png",
    learnerPriority: "Relate the English label fields to the Bengali handling instructions.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...dates,
    pages: [
      {
        pageNumber: 1,
        route: "page_transcription",
        text: "A workshop chemical label should show the product name, hazard warning, and required protective equipment. The label must remain readable and attached to the container.\n\nকোনো রাসায়নিক পদার্থ অন্য পাত্রে নিলে নতুন পাত্রেও সঠিক লেবেল দিতে হবে। লেবেল না থাকলে পদার্থটি ব্যবহার করা যাবে না। ছিটকে পড়লে কাজ বন্ধ করে নির্ধারিত spill procedure অনুসরণ করতে হবে এবং supervisor-কে জানাতে হবে।",
      },
    ],
  },
] as const;

export const goldenDemoMaterial: EvaluationCorpusMaterial = {
  id: "GOLDEN-DEMO-01",
  title: "Safe Drinking Water / নিরাপদ পানীয় জল",
  domain: "academic_science",
  language: "mixed",
  inputType: "pasted_text",
  fixturePath: null,
  learnerPriority: "Separate source protection, treatment, and safe storage.",
  licence: "CC-BY-4.0",
  provenance: "team-authored",
  publicSafe: true,
  ...dates,
  pages: [
    {
      pageNumber: 1,
      route: "pasted_text",
      text: "নিরাপদ পানীয় জলের জন্য প্রথমে তুলনামূলক পরিষ্কার উৎস বেছে নিতে হয়। ফুটিয়ে জীবাণু কমানো যায়, কিন্তু ফুটানো পানি আবার নোংরা পাত্রে রাখলে পুনরায় দূষিত হতে পারে।\n\nAfter treatment, water should be kept in a clean, covered container. A narrow opening or a clean pouring method reduces contact with hands and utensils. Treatment and safe storage are separate barriers, and both are needed in the household safety chain.",
    },
  ],
};

const task06cDates = {
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
} as const;

export const task06cHoldoutCorpus: readonly EvaluationCorpusMaterial[] = [
  {
    id: "SCI-MIX-PASTE-02",
    title: "Battery Energy and Safe Charging / ব্যাটারি চার্জিং",
    domain: "academic_science",
    language: "mixed",
    inputType: "pasted_text",
    fixturePath: null,
    learnerPriority: "Connect energy conversion with the stated charging-safety limits.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...task06cDates,
    pages: [{
      pageNumber: 1,
      route: "pasted_text",
      text: "A rechargeable battery stores energy through chemical changes during charging and supplies electrical energy during use. Charging also produces heat, so the charger must match the battery type and rated voltage.\n\nব্যাটারি ফুলে গেলে, অস্বাভাবিক গরম হলে বা গন্ধ বের হলে চার্জিং বন্ধ করতে হবে। বাতাস চলাচল করে এমন শুকনা স্থানে চার্জ দিতে হবে এবং ক্ষতিগ্রস্ত তার ব্যবহার করা যাবে না। আগুন লাগলে পানি ব্যবহার না করে নির্ধারিত battery-fire procedure অনুসরণ করতে হবে।",
    }],
  },
  {
    id: "CIV-BN-PASTE-02",
    title: "বিদ্যালয়ে ভূমিকম্পের সময় নিরাপদ প্রতিক্রিয়া",
    domain: "bangladesh_civics",
    language: "bn",
    inputType: "pasted_text",
    fixturePath: null,
    learnerPriority: "কম্পনের সময় ও কম্পন থামার পরে করণীয় আলাদা করে বুঝতে চাই।",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...task06cDates,
    pages: [{
      pageNumber: 1,
      route: "pasted_text",
      text: "ভূমিকম্পের কম্পন শুরু হলে শ্রেণিকক্ষের শিক্ষার্থীরা নিচু হয়ে মজবুত টেবিলের নিচে আশ্রয় নেবে এবং টেবিলের পা ধরে থাকবে। জানালা, আলমারি ও ঝুলন্ত বস্তুর কাছ থেকে দূরে থাকতে হবে। কম্পনের সময় সিঁড়ি বা লিফট ব্যবহার করে বাইরে দৌড়ানো যাবে না।\n\nকম্পন থামলে শিক্ষক নির্ধারিত পথ ধরে সবাইকে খোলা সমাবেশস্থলে নিয়ে যাবেন। উপস্থিতি যাচাই করতে হবে এবং আহত ব্যক্তির তথ্য দায়িত্বপ্রাপ্ত কর্মীকে জানাতে হবে। ভবন নিরাপদ ঘোষণা না হওয়া পর্যন্ত ভেতরে ফেরা যাবে না।",
    }],
  },
  {
    id: "VOC-EN-PASTE-02",
    title: "Portable Ladder Setup and Inspection",
    domain: "vocational_safety",
    language: "en",
    inputType: "pasted_text",
    fixturePath: null,
    learnerPriority: "Learn the inspection and setup sequence before climbing.",
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    publicSafe: true,
    ...task06cDates,
    pages: [{
      pageNumber: 1,
      route: "pasted_text",
      text: "Before use, a worker checks a portable ladder for cracked rails, missing rungs, loose hardware, oil, and mud. A damaged ladder is labelled and removed from service rather than repaired temporarily at the work area.\n\nThe ladder is placed on a firm, level surface and secured against movement. For access to an upper level, the rails extend above the landing so the worker has a handhold. The worker faces the ladder, keeps three points of contact, and carries tools in a belt or hoists them separately.",
    }],
  },
] as const;

export const task06cEvaluationCorpus: readonly EvaluationCorpusMaterial[] = [
  ...evaluationCorpus,
  ...task06cHoldoutCorpus,
];

export function materialText(material: EvaluationCorpusMaterial): string {
  return material.pages.map((page) => page.text).join("\n\n");
}
