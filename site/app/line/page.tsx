import { notFound } from "next/navigation";
import { Story } from "@/components/story/Story";

export const metadata = { title: "Линия · стенд" };

export default function LinePage() {
  // рабочий стенд: на опубликованном сайте его нет, модели для него в репозиторий не идут
  if (process.env.NODE_ENV === "production") notFound();
  return <Story />;
}
