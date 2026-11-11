import { CHAPTERS, CONTACTS, EMAIL, INTRO } from "@/lib/story";
import styles from "./outline.module.css";

// Вся история обычным текстом. На экране её показывает сцена, по одной остановке за раз, и в HTML
// попадал только первый экран: поисковик и экранная читалка остального не видели. Здесь тот же
// текст целиком и по порядку, скрытый с экрана, но не от чтения.
export function Outline() {
  return (
    <section className={styles.outline} aria-label="Career in text">
      <h2>
        {INTRO.name}, {INTRO.role.toLowerCase()}
      </h2>
      <p>Product designer, ex-frontend developer. I wrote frontend for about eight years before moving to design.</p>
      {CHAPTERS.map((c) => (
        <article key={c.id}>
          <h3>
            {c.place}, {c.years.replace(/ —$/, " — now")}
          </h3>
          <p>{c.role}</p>
          <p>{c.about}</p>
          <p>{c.line}</p>
          {c.team && <p>Team: {c.team}</p>}
          {c.did && (
            <ul>
              {c.did.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <p>Stack: {c.stack.join(", ")}</p>
          {c.links?.map((l) => (
            <div key={l.label}>
              <h4>{l.href ? <a href={l.href}>{l.label}</a> : l.label}</h4>
              {l.note && <p>{l.note}</p>}
              {l.more && (
                <>
                  <p>
                    {l.more.year}. {l.more.role}
                  </p>
                  {l.more.story.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <p>Stack: {l.more.stack.join(", ")}</p>
                </>
              )}
            </div>
          ))}
        </article>
      ))}
      <h3>Contact</h3>
      <ul>
        <li>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </li>
        {CONTACTS.filter((c) => c.href.startsWith("http")).map((c) => (
          <li key={c.label}>
            <a href={c.href}>{c.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Кто это, для поисковиков: человек, должность, где его ещё найти. */
export function PersonData({ site }: { site: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: INTRO.name,
    alternateName: "Андрей Солин",
    jobTitle: "Product designer",
    description: "Product designer, ex-frontend developer",
    url: site,
    image: `${site}/opengraph-image.png`,
    email: `mailto:${EMAIL}`,
    sameAs: CONTACTS.filter((c) => c.href.startsWith("http")).map((c) => c.href),
    knowsAbout: ["Product design", "UI design", "Design systems", "Information architecture", "Frontend development", "React", "TypeScript"],
    worksFor: { "@type": "Organization", name: "Symmetre" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
