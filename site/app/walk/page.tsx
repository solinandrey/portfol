import { notFound } from "next/navigation";
import { Walk } from "@/components/walk/Walk";

export const metadata = { title: "Частицы · стенд" };

export default function WalkPage() {
  // рабочий стенд: на опубликованном сайте его нет, модели для него в репозиторий не идут
  if (process.env.NODE_ENV === "production") notFound();
  return <Walk />;
}
