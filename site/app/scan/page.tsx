import { notFound } from "next/navigation";
import { ScanLab } from "@/components/lab/ScanLab";

export const metadata = { title: "Скан · стенд" };

export default function ScanPage() {
  // рабочий стенд: на опубликованном сайте его нет, модели для него в репозиторий не идут
  if (process.env.NODE_ENV === "production") notFound();
  return <ScanLab />;
}
