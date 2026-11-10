import { notFound } from "next/navigation";
import { ModelLab } from "@/components/lab/ModelLab";

export const metadata = { title: "Модель · стенд" };

export default function ModelPage() {
  // рабочий стенд: на опубликованном сайте его нет, модели для него в репозиторий не идут
  if (process.env.NODE_ENV === "production") notFound();
  return <ModelLab />;
}
