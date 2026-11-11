import { DotsStory } from "@/components/dots/DotsStory";
import { PORTRAITS } from "@/lib/portrait";
import { Outline, PersonData } from "@/components/seo/Outline";
import { SITE } from "@/lib/site";

export default function Home() {
  return (
    <main>
      {/* портрет начинает качаться вместе со страницей, не дожидаясь скриптов сайта: свой файл
          для телефона, планшета и компьютера. Приоритет низкий, чтобы не отбирать канал у скриптов */}
      {PORTRAITS.map((p) => (
        <link key={p.file} rel="preload" as="fetch" href={p.file} media={p.media} crossOrigin="anonymous" fetchPriority="low" />
      ))}
      <PersonData site={SITE} />
      <Outline />
      <DotsStory />
    </main>
  );
}
