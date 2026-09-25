import Link from "next/link";
import styles from "./navigation.module.css";

export function NavigationLinks({ label, items }: {
  label: string;
  items: readonly { href: string; title: string; description?: string }[];
}) {
  return <nav aria-label={label}><ul className={styles.links}>
    {items.map(item => <li key={item.href}>
      <Link href={item.href} className={styles.link}>
        <span>{item.title}{item.description && <small>{item.description}</small>}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </li>)}
  </ul></nav>;
}
