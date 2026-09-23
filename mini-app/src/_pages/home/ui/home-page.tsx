import Link from "next/link";

export function HomePage() {
  return <>
    <h1>Мой дом</h1>
    <p><Link href="/issues" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Мои обращения</Link></p>
  </>;
}
