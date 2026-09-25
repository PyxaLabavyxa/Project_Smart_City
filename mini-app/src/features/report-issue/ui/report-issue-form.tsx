"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIssues, issueCategories } from "@/entities/issue";
import styles from "./report-issue.module.css";

export function ReportIssueForm({ cancelHref = "/issues" }: { cancelHref?: string }) {
  const { addIssue } = useIssues();
  const router = useRouter();
  const submitted = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const read = (key: string) => String(values.get(key) ?? "").trim();
    const nextErrors: Record<string, string> = {};
    for (const key of ["location", "category", "title", "description"]) {
      if (!read(key)) nextErrors[key] = "Заполните это поле";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (form.elements.namedItem(Object.keys(nextErrors)[0]) as HTMLElement)?.focus();
      return;
    }
    submitted.current = true;
    setSaving(true);
    const id = addIssue({ title: read("title"), description: read("description"), category: read("category"), location: read("location") });
    router.push("/issues/" + id);
  }
  const error = (name: string) => errors[name] ? <span className={styles.error} id={name + "-error"}>{errors[name]}</span> : null;
  return <form className={styles.form} onSubmit={submit} onChange={event => {
    const field = event.target;
    if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) && field.value.trim() && errors[field.name]) {
      setErrors(current => { const next = { ...current }; delete next[field.name]; return next; });
    }
  }} noValidate>
    <p className={styles.note}>Укажите место и опишите проблему.</p>
    <label className={styles.field}>Место проблемы
      <input name="location" placeholder="Например: подъезд 2, этаж 8, лестница" maxLength={160} required aria-invalid={!!errors.location} aria-describedby={errors.location ? "location-error" : undefined} />
      {error("location")}
    </label>
    <label className={styles.field}>Категория
      <select name="category" defaultValue="" required aria-invalid={!!errors.category} aria-describedby={errors.category ? "category-error" : undefined}>
        <option value="" disabled>Выберите категорию</option>
        {issueCategories.map(category => <option key={category}>{category}</option>)}
      </select>{error("category")}
    </label>
    <label className={styles.field}>Что случилось?
      <input name="title" placeholder="Кратко опишите проблему" maxLength={120} required aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
      {error("title")}
    </label>
    <label className={styles.field}>Описание
      <textarea name="description" placeholder="Что произошло и где нужна помощь?" rows={5} maxLength={2000} required aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} />
      {error("description")}
    </label>
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={saving}>{saving ? "Сохраняем…" : "Создать обращение"}</button><Link href={cancelHref}>Отмена</Link></div>
  </form>;
}
