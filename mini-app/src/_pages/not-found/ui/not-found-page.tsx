import Link from "next/link";

export function NotFoundPage() {
  return (
    <>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь на главную.</p>
      <Link href="/">Вернуться на главную</Link>
    </>
  );
}
