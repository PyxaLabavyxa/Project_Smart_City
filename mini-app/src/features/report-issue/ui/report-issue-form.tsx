"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIssues, issueCategories, similarIssues, IssueCategoryIcon } from "@/entities/issue";
import { LocationSelector, formatLocation, validLocation, useHouseSelection } from "@/entities/house";
import styles from "./report-issue.module.css";

const steps = ["Место", "Категория", "Описание", "Создание"];
const stepTitles = ["Где возникла проблема?", "Что случилось?", "Расскажите о проблеме", "Проверьте обращение"];
export function ReportIssueForm({ cancelHref = "/issues" }: { cancelHref?: string }) {
  const { addIssue, issues, draft, updateDraft, resetDraft } = useIssues();
  const { house } = useHouseSelection();
  const router = useRouter();
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const matches = similarIssues(issues, draft.place, draft.category);
  function goToStep(step: number) {
    updateDraft({ step });
    setErrors({});
    setFailure("");
    formRef.current?.scrollIntoView({ block: "start" });
    requestAnimationFrame(() => formRef.current?.querySelector("legend")?.focus({ preventScroll: true }));
  }
  function validate() {
    const next: Record<string, string> = {};
    if (!validLocation(house, draft.place)) next.place = "Выберите место в доме";
    if (draft.step >= 1 && !issueCategories.some(category => category === draft.category)) next.category = "Выберите категорию";
    if (draft.step >= 2 && !draft.title.trim()) next.title = "Укажите, что случилось";
    if (draft.step >= 2 && !draft.description.trim()) next.description = "Добавьте описание проблемы";
    setErrors(next);
    return !Object.keys(next).length;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    if (!validate()) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (draft.step < 3) { goToStep(draft.step + 1); return; }
    submitted.current = true;
    setSaving(true); setFailure("");
    try {
      const id = await addIssue({ place: draft.place, category: draft.category, title: draft.title, description: draft.description });
      router.push("/issues/" + id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Не удалось создать обращение. Попробуйте ещё раз.");
      submitted.current = false; setSaving(false);
    }
  }
  const error = (name: string) => errors[name] ? <span className={styles.error} id={name + "-error"} role="alert">{errors[name]}</span> : null;
  return <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
    <p className={styles.note} aria-live="polite">Шаг {draft.step + 1} из {steps.length} · {steps[draft.step]}</p>
    <ol className={styles.steps} aria-label="Этапы обращения">{steps.map((step, index) => <li key={step} data-reached={index <= draft.step || undefined} aria-current={draft.step === index ? "step" : undefined}><span>{index + 1}</span>{step}</li>)}</ol>
    <fieldset className={styles.fields} disabled={saving}>
      <legend tabIndex={-1}>{stepTitles[draft.step]}</legend>
      {draft.step > 0 && <p className={styles.context}>{draft.step > 1 && `${draft.category} · `}{formatLocation(draft.place)} <button type="button" onClick={() => goToStep(0)}>Изменить место</button></p>}
      {draft.step === 0 && <><LocationSelector value={draft.place} onChange={place => updateDraft({ place })} problemPlaces={issues.filter(issue => issue.status !== "completed").flatMap(issue => issue.place ? [issue.place] : [])} />{error("place")}</>}
      {draft.step === 1 && <><div className={styles.categories} role="radiogroup" aria-label="Категория" tabIndex={-1} aria-invalid={!!errors.category} aria-describedby={errors.category ? "category-error" : undefined}>
        {issueCategories.map(category => <label key={category} className={styles.category}>
          <input type="radio" name="category" value={category} checked={draft.category === category} onChange={() => { updateDraft({ category }); setErrors({}); }} />
          <IssueCategoryIcon category={category} /><span>{category}</span>
        </label>)}
      </div>{error("category")}</>}
      {draft.step === 2 && <>
        <label className={styles.field}>Что случилось?
          <input name="title" placeholder="Например, течёт труба возле стояка" value={draft.title} onChange={event => { updateDraft({ title: event.target.value }); setErrors(current => ({ ...current, title: "" })); }} maxLength={120} aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
          {error("title")}
        </label>
        <label className={styles.field}>Описание
          <textarea name="description" placeholder="Что вы заметили и когда это началось" value={draft.description} onChange={event => { updateDraft({ description: event.target.value }); setErrors(current => ({ ...current, description: "" })); }} rows={5} maxLength={2000} aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} />
          {error("description")}
        </label>
      </>}
      {draft.step === 3 && <div className={styles.review}><h2>{draft.title}</h2><p>{house.address}</p><p>{formatLocation(draft.place)}</p><p>{draft.category}</p><p className={styles.description}>{draft.description}</p></div>}
    </fieldset>
    {matches.length > 0 && draft.step >= 1 && <aside className={styles.similar} aria-label="Похожие обращения"><strong>Возможно, об этой проблеме уже сообщили</strong><p>В этом месте есть активные обращения той же категории. Можно открыть их или продолжить создание.</p>{matches.map(issue => <Link key={issue.id} href={"/issues/" + issue.id}>{issue.title}</Link>)}</aside>}
    {failure && <p role="alert" className={styles.error}>{failure}</p>}
    <div className={styles.actions}>
      {draft.step > 0 && <button type="button" className={styles.previous} disabled={saving} onClick={() => goToStep(draft.step - 1)}>← Назад</button>}
      <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Сохраняем…" : draft.step === 3 ? "Создать обращение" : "Продолжить"}</button>
    </div>
    <div className={styles.draftActions}>
      <Link href={cancelHref} aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}>Сохранить черновик и выйти</Link>
      <button type="button" disabled={saving} onClick={() => { if (window.confirm("Удалить черновик обращения?")) { resetDraft(); setErrors({}); } }}>Сбросить черновик</button>
    </div>
  </form>;
}
