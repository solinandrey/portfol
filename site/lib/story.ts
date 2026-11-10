// История карьеры. Один источник правды: из этих строк собираются и левая сторона (дизайн),
// и правая (код той эпохи). Текст в коде помечен ⟦…⟧ — он яркий, остальной код приглушён,
// поэтому историю можно прочитать на любой стороне линии.

export type Media = { src: string; alt: string; ratio: string };

/** Разбор проекта: открывается по клику поверх сцены. */
export type Case = {
  year: string;
  role: string;
  /** запись экрана на Vimeo: номер ролика и ключ закрытой ссылки */
  video?: { id: string; hash: string };
  /** абзацы по порядку: что это, что было трудным, что сделал я */
  story: string[];
  stack: string[];
};

export type Project = { label: string; href?: string; note?: string; image?: string; more?: Case };

export type Chapter = {
  id: string;
  years: string;
  place: string;
  role: string;
  line: string;
  /** небольшая подводка над годами */
  kicker?: string;
  /** чем занимается компания или проект */
  about: string;
  /** на чём делалось */
  stack: string[];
  /** что делал, коротко по пунктам: из резюме */
  did?: string[];
  /** с кем работал или кем руководил */
  team?: string;
  /** проекты: что можно открыть, одной строкой что это, и скриншот для превью при наведении */
  links?: Project[];
  /** что осталось от этого этапа: слово копится внизу экрана */
  took?: string;
  /** где стоит линия, % ширины экрана и % высоты на телефоне */
  split: number;
  splitNarrow: number;
  /** ширина шрифта: заголовку становится просторнее вместе с дизайном */
  stretch: number;
  /** размер заголовка в процентах от ширины колонки */
  fit: number;
  /** название пишется строчными: fatstack всегда так */
  lowercase?: boolean;
  media?: Media;
  code: string;
};

export const INTRO = {
  name: "Andrey Solin",
  role: "Product designer",
  line: "Before that I was a frontend developer for about eight years.",
  split: 93,
  splitNarrow: 86,
  code: `// andrey.ts
export const andrey = {
  name: ⟦"Andrey Solin"⟧,
  role: ⟦"Product designer"⟧,
  before: ⟦"Frontend, about eight years"⟧,
  stillCodes: true,
};`,
};

export const CHAPTERS: Chapter[] = [
  {
    id: "12digital",
    kicker: "It started on the other side of the line.",
    years: "2017 — 2018",
    place: "12 Digital",
    role: "Junior frontend developer",
    about: "A digital agency building websites for clients.",
    line: "Several client sites at once. Designers handed over layouts; I built them and checked with the design team until the page matched the idea.",
    stack: ["HTML", "SCSS", "JavaScript", "jQuery", "Vue"],
    did: ["Built new layouts and kept legacy ones alive", "Ran several projects in parallel, each with its own deadline", "Shipped my first projects in Vue"],
    took: "Layout",
    split: 27,
    splitNarrow: 42,
    stretch: 62,
    fit: 23,
    code: `<!-- 2017–2018 -->
<div class="job">
  <h2>⟦{{place}}⟧</h2>
  <p class="role">⟦{{role}}⟧</p>
  <p>
    ⟦First job. Sites for all kinds of clients,⟧
    ⟦mostly plain HTML, CSS and jQuery.⟧
    ⟦Design arrived as a layout.⟧
    ⟦My job was to make it real.⟧
  </p>
</div>

<script src="js/jquery.min.js"></script>
<script>
  $(document).ready(function () {
    $('.job').hide().fadeIn(400);
  });
</script>`,
  },
  {
    id: "beta",
    years: "2019 — 2021",
    place: "Beta Digital",
    role: "Frontend developer → team lead",
    about: "Creative digital studio known for experimental, animation-driven websites.",
    line: "A studio where every site was an experiment. I worked side by side with designers on complex layouts and a lot of motion, and together we made it feel right and run fast on real devices. Ended up leading five developers.",
    stack: ["Vue", "Nuxt", "GSAP", "Lottie", "p5", "TypeScript", "Stylus"],
    did: [
      "Close partnership with designers on experimental layouts",
      "Animation at the core: scroll scenes, transitions, generative graphics",
      "Helped designers balance visual impact with usability and speed",
      "Profiled rendering, so heavy pages stayed smooth",
      "Mentored juniors, then led a team of five",
    ],
    links: [
      {
        label: "Absolut Insurance",
        href: "https://vimeo.com/766458572/ee71c4bd8f",
        note: "insurance site with online sales, led the frontend team",
        image: "/work/absolut.jpg",
        more: {
          year: "2021",
          role: "Frontend team lead, five developers",
          video: { id: "766458572", hash: "ee71c4bd8f" },
          story: [
            "An insurance company's website with two jobs: look nothing like insurance, and sell policies online.",
            "Five frontend developers and very little time. I split the work by complexity, so the animated pages and the product forms moved in parallel.",
            "We wrote our own form builder. After that, pages with forms came together much faster.",
            "The card animations were drawn in After Effects, play through Lottie and follow where you are on the page. Menus run on GSAP. We profiled all of it and removed the bottlenecks one by one.",
          ],
          stack: ["Nuxt", "GSAP", "Lottie", "TypeScript", "Stylus"],
        },
      },
      {
        label: "Sibur Digital",
        href: "https://vimeo.com/349689739/a688799f38",
        note: "digital magazine, a design experiment on every page",
        image: "/work/sibur.jpg",
        more: {
          year: "2019",
          role: "Frontend developer",
          video: { id: "349689739", hash: "a688799f38" },
          story: [
            "A digital magazine about how the oil and gas industry goes digital.",
            "Every page is its own design experiment: event cards you can drag around, lines of text that never stop running.",
            "Most of the motion is GSAP. A large share of the time went into making it run well on most devices.",
          ],
          stack: ["Nuxt", "GSAP", "TypeScript", "Stylus"],
        },
      },
      {
        label: "RASU",
        href: "https://www.rasu.ru/en/",
        note: "navigation through animated posters, p5 graphics",
        image: "/work/rasu.jpg",
        more: {
          year: "2020",
          role: "Frontend developer",
          story: [
            "A website for Rosatom's automated control systems, the software side of nuclear power stations.",
            "You navigate through animated posters. Scrolling the main page switches the poster; a click carries you into the project with no visible page change.",
            "Designers drew the posters in After Effects. I brought them to the browser with Lottie and tested them again and again to keep rendering light.",
            "Inner pages carry generative graphics in p5 that react to scrolling and to the cursor.",
          ],
          stack: ["Nuxt", "Lottie", "p5", "TypeScript", "Stylus"],
        },
      },
    ],
    took: "Motion",
    split: 41,
    splitNarrow: 52,
    stretch: 72,
    fit: 15.5,
    media: { src: "/work/rasu.jpg", alt: "Website for Rosatom Automated Control Systems", ratio: "16 / 9" },
    code: `<template>
  <section ref="job" class="job">
    <h2>⟦{{place}}⟧</h2>
    <p class="role">⟦{{role}}⟧</p>
    <p>
      ⟦A studio making experimental,⟧
      ⟦animation-heavy sites. Designers brought⟧
      ⟦After Effects, I made it run smoothly⟧
      ⟦in a browser, and started having opinions⟧
      ⟦about how things should move.⟧
      ⟦Ended up leading five developers.⟧
    </p>
  </section>
</template>

<script>
import gsap from 'gsap'

export default {
  mounted() {
    gsap.from(this.$refs.job, {
      y: 40,
      opacity: 0,
      ease: 'expo.out',
    })
  },
}
</script>`,
  },
  {
    id: "citymobil",
    years: "2021 — 2022",
    place: "Citymobil",
    role: "Frontend developer, Fleet",
    about: "Taxi and ride-hailing service. Fleet is its B2B product: taxi companies use it to manage drivers, rides and reports.",
    line: "I built dashboards, reports and forms and worked with the product designer every day. Then I began proposing changes to tables and hierarchy, not only building them.",
    stack: ["React", "MobX", "TypeScript", "Styled Components", "Storybook", "Figma"],
    did: [
      "New Fleet features in React and MobX",
      "Dashboards, ride reports, tables and charts",
      "Multi-step forms, filters and role-based screens",
      "Moved legacy Angular code to React",
      "Proposed better hierarchy and table layouts",
    ],
    team: "5 devs · 2 QA · product designer · PM",
    took: "Data",
    split: 54,
    splitNarrow: 60,
    stretch: 84,
    fit: 16,
    media: { src: "/work/fleet.jpg", alt: "Fleet, the B2B product for taxi companies", ratio: "1344 / 847" },
    code: `const Job = observer(() => {
  const { rides, filters } = useFleetStore();

  return (
    <Page title=⟦"{{place}}"⟧>
      <Role>⟦{{role}}⟧</Role>
      <Text>
        ⟦The B2B product taxi companies⟧
        ⟦run on: drivers, rides, reports.⟧
        ⟦I worked with the product designer⟧
        ⟦every day and started proposing⟧
        ⟦changes to tables and hierarchy⟧
        ⟦instead of just building them.⟧
      </Text>
      <Table rows={rides} filters={filters} />
    </Page>
  );
});`,
  },
  {
    id: "freelance",
    years: "2022 — 2023",
    place: "Freelance",
    role: "Ruvento Ventures: website and admin panel",
    about: "Whole projects on my own, from the first call to deploy. The main one: Ruvento Ventures, a fund backing Southeast Asian tech.",
    line: "Clients came with an idea, I took it to production: structure, interface, code, and a CMS so they could run it themselves.",
    stack: ["React", "Next.js", "TypeScript", "SCSS", "Strapi", "AWS"],
    did: ["Public website for the fund", "Admin panel on Strapi, so the team edits everything themselves", "Whole cycle alone, from structure to deploy"],
    links: [
      {
        label: "Ruvento Ventures",
        href: "https://www.ruvento.com/",
        note: "venture fund backing Southeast Asian tech",
        image: "/work/ruvento.jpg",
        more: {
          year: "2022",
          role: "Frontend and CMS, solo",
          story: [
            "A website for a venture fund: what it invests in, its portfolio, and a way for founders and investors to get in touch.",
            "Built on Next.js with server rendering and tuned for load speed.",
            "Behind it sits Strapi. The fund's team adds companies, news and people themselves, without a developer.",
          ],
          stack: ["Next.js", "React", "Strapi", "SCSS"],
        },
      },
    ],
    took: "Ownership",
    split: 66,
    splitNarrow: 68,
    stretch: 96,
    fit: 14,
    media: { src: "/work/ruvento.jpg", alt: "Ruvento Ventures website", ratio: "16 / 9" },
    code: `export async function getStaticProps() {
  const job = await strapi.find('jobs', {
    slug: 'ruvento',
  });
  return { props: { job }, revalidate: 60 };
}

export default function Job({ job }) {
  return (
    <>
      <h2>⟦{{place}}⟧</h2>
      <p>⟦{{role}}⟧</p>
      <p>
        ⟦A site for an investment fund⟧
        ⟦and the admin panel behind it,⟧
        ⟦start to finish. Whatever wasn't⟧
        ⟦decided yet, I had to decide.⟧
      </p>
    </>
  );
}`,
  },
  {
    id: "sumsub",
    years: "2023 — 2025",
    place: "Sumsub",
    role: "Senior frontend developer",
    about: "Identity verification and anti-fraud platform for businesses worldwide.",
    line: "Marketing's special projects, product pages, and the page builder the team now assembles reports from. I sat with designers before any of it was built.",
    stack: ["React", "Next.js", "TypeScript", "SCSS", "Figma"],
    did: [
      "Planned layout, behaviour and usability with designers up front",
      "Complex visuals into maintainable components, our UI kit in sync with Figma",
      "Animation-heavy landings that still load fast",
      "Led two developers, reviewed their code and UI decisions",
    ],
    links: [
      { label: "Greenflag", href: "https://greenflag.me/", note: "campaign site with a film" },
      { label: "Fraudlympics", href: "https://sumsub.com/fraudlympics/", note: "fraud trends as an olympics", image: "/work/fraudlympics.jpg" },
      { label: "Fraudo", href: "https://sumsub.com/fraudo/", note: "story of how scammers work", image: "/work/fraudo.jpg" },
      { label: "AI: Friend or Foe", href: "https://sumsub.com/ai-friend-or-foe/", note: "interactive piece on AI ethics", image: "/work/ai-friend-or-foe.jpg" },
      { label: "Global Fraud Index", href: "https://sumsub.com/global-fraud-index/", note: "research with a ranking", image: "/work/global-fraud-index.jpg" },
      { label: "The Sumsuber", href: "https://sumsub.com/media/", note: "compliance media", image: "/work/sumsuber.jpg" },
    ],
    took: "Systems",
    split: 78,
    splitNarrow: 76,
    stretch: 108,
    fit: 15,
    code: `export const Job = ({ tone = 'neutral' }: JobProps) => (
  <Stack gap="s6" tone={tone}>
    <Heading size="xl">⟦{{place}}⟧</Heading>
    <Text variant="caption">⟦{{role}}⟧</Text>
    <Text>
      ⟦Identity verification. I was in the room⟧
      ⟦before implementation: layout and behaviour⟧
      ⟦talks with designers, Figma and our own⟧
      ⟦UI kit kept in sync, animated landing⟧
      ⟦pages, two developers to mentor.⟧
    </Text>
  </Stack>
);`,
  },
  {
    id: "symmetre",
    kicker: "Crossed the line.",
    years: "2026 —",
    place: "Symmetre",
    role: "Product / UI designer",
    about: "B2B platform for real-estate investment fund management.",
    line: "From information architecture down to components and the design system: reporting, dense tables, analytics. The screens are under NDA.",
    stack: ["Figma", "Storybook", "Claude Design", "Claude Code"],
    did: [
      "Requirements first-hand from the business, turned into design decisions",
      "Reporting dashboards, multi-column tables, analytical widgets",
      "Design system: components, patterns, visual language",
      "UX reviews of hierarchy, layout and flows",
      "Design critiques, presenting the reasoning in product terms",
      "Work in Figma, and mostly in Claude Design and Claude Code",
    ],
    split: 86,
    splitNarrow: 80,
    stretch: 116,
    fit: 13.5,
    code: `// report.fig
frame ⟦"{{place}}"⟧ {
  role: ⟦"{{role}}"⟧,
  layout: "table",
  columns: 14,
  density: "compact",
}`,
  },
  {
    id: "fatstack",
    years: "2026 —",
    place: "fatstack",
    role: "Side project, with a friend",
    about: "A net worth tracker for people with money in several currencies. A side project with a friend.",
    line: "We build it as a pair and make product decisions together. The design is my part.",
    stack: ["Figma", "Next.js", "TypeScript", "Supabase", "GSAP"],
    did: ["Product decisions, made together with my friend", "Design system", "Interface for mobile and web", "Landing page"],
    links: [{ label: "fatstack.app", href: "https://fatstack.app", image: "/work/fatstack.jpg" }],
    lowercase: true,
    split: 93,
    splitNarrow: 86,
    stretch: 125,
    fit: 13,
    media: { src: "/work/fatstack.jpg", alt: "fatstack dashboard", ratio: "1500 / 850" },
    code: `// design.tokens.json
{
  "product": ⟦"{{place}}"⟧,
  "color.line": "#FF4A1C",
  "still.writes.code": true
}`,
  },
];

/** К чему всё шло: первая строка после истории. */
export const THESIS = "If you want to talk, message me.";

export const WORK = [
  { year: "2026", name: "fatstack", what: "Net worth tracker. Product design, landing, frontend", href: "https://fatstack.app" },
  { year: "2022", name: "Ruvento Ventures", what: "Investment fund. Website and admin panel", href: "https://www.ruvento.com/" },
  { year: "2021", name: "Fleet", what: "B2B product for taxi companies. Frontend" },
  { year: "2021", name: "Absolut Insurance", what: "Insurance site. Led the frontend team of five" },
  { year: "2020", name: "RASU", what: "Rosatom automated control systems. Animated posters, p5", href: "https://www.rasu.ru/en/" },
  { year: "2019", name: "Sibur Digital", what: "Digital magazine. Motion, GSAP" },
];

export const EMAIL = "solinandrey@gmail.com";

export const CONTACTS = [
  { label: "Email", href: `mailto:${EMAIL}` },
  { label: "Telegram", href: "https://t.me/soul_in" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/andreysolin/" },
  { label: "Instagram", href: "https://www.instagram.com/solinandrey/" },
];
