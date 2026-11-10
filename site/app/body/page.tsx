import { notFound } from "next/navigation";
import { HeadLab } from "@/components/lab/HeadLab";

export const metadata = { title: "Голова и тело · стенд" };

export default function BodyPage() {
  // рабочий стенд: на опубликованном сайте его нет, модели для него в репозиторий не идут
  if (process.env.NODE_ENV === "production") notFound();
  return <HeadLab />;
}
