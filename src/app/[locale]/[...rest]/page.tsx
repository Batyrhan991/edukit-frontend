import { notFound } from "next/navigation";

/** Любой неизвестный адрес внутри языка показывает фирменную страницу 404 с переводом. */
export default function CatchAllPage() {
  notFound();
}
