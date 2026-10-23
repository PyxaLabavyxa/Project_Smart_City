"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIssues, similarIssues, IssueCategoryIcon } from "@/entities/issue";
import { formatLocation, validLocation, useHouseSelection } from "@/entities/house";
import styles from "./report-issue.module.css";
import { categoriesForPlace, reportCategoryLabel, reportScope, reportVisibilityLabel } from "@/entities/issue/model/report-categories";
import { ReportLocationPicker } from "./report-location-picker";
import { initialReportStep } from "@/entities/issue/model/issue-draft";
import { PhotoPicker } from "./photo-picker";
import { Icon } from "@/shared/ui/icon";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { useConfirmation } from "@/shared/ui/confirmation";

const categorySteps = [{ id: 1, label: "Категория" }, { id: 2, label: "Описание" }, { id: 3, label: "Проверка" }];
const stepTitles = ["Уточните место на плане", "Что случилось?", "Расскажите о проблеме", "Проверьте обращение"];
export function ReportIssueForm({ cancelHref = "/issues", cancelLabel = "Все обращения" }: { cancelHref?: string; cancelLabel?: string }) {
  const confirm = useConfirmation();
  const { addIssue, issues, draft, creating, updateDraft, resetDraft } = useIssues();
  const { house, choices } = useHouseSelection();
  const router = useRouter();
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [navigating, setNavigating] = useState(false);
  const saving = creating || navigating;
  const [failure, setFailure] = useState("");
  const matches = similarIssues(issues, draft.place, draft.category);
  const categories = categoriesForPlace(draft.place);
  const categoryLabel = reportCategoryLabel(draft.place, draft.category);
  const needsPlan = reportScope(draft.place) === "entrance";
  const steps = needsPlan ? [{ id: 0, label: "Место" }, ...categorySteps] : categorySteps;
  const stepIndex = steps.findIndex(step => step.id === draft.step);
  const backStep = draft.step > (needsPlan ? 0 : 1) ? draft.step - 1 : -1;
  function goToStep(step: number) {
    updateDraft({ step });
    setErrors({});
    setFailure("");
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => formRef.current?.querySelector("legend")?.focus({ preventScroll: true }));
  }
  function validate() {
    const next: Record<string, string> = {};
    if (!validLocation(house, draft.place)) next.place = "Выберите место в доме";
    const place = draft.place;
    if (place.zone === "apartment" && !choices.some(choice => choice.houseId === house.id && choice.apartment === place.apartment)) next.place = "Обращение внутри квартиры доступно только её жильцам. Выберите свою квартиру или общую зону.";
    if (draft.step >= 1 && !categories.some(category => category.value === draft.category)) next.category = "Выберите подкатегорию для этого места";
    if (draft.step >= 2 && !draft.title.trim()) next.title = "Укажите, что случилось";
    if (draft.step >= 2 && !draft.description.trim()) next.description = "Добавьте описание проблемы";
    setErrors(next);
    return !Object.keys(next).length;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || saving) return;
    if (!validate()) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (draft.step < 3) { goToStep(draft.step < 0 ? initialReportStep(draft.place) : draft.step + 1); return; }
    submitted.current = true;
    setFailure("");
    try {
      const id = await addIssue({ place: draft.place, category: draft.category, title: draft.title, description: draft.description, photos: draft.photos });
      setNavigating(true);
      router.push("/issues/" + id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Не удалось создать обращение. Попробуйте ещё раз.");
      submitted.current = false; setNavigating(false);
    }
  }
  const error = (name: string) => errors[name] ? <span className={styles.error} id={name + "-error"} role="alert">{errors[name]}</span> : null;
  return <><header className={styles.pageHeader}>
    {draft.step >= 0 ? <button type="button" disabled={saving} aria-label="Назад: предыдущий шаг" onClick={() => goToStep(backStep)}><Icon name="back" size={24} /></button> : <Link href={cancelHref} aria-label={`Назад: ${cancelLabel}`}><Icon name="back" size={24} /></Link>}
    <BrandWordmark /><Link href={cancelHref} aria-label="Закрыть создание обращения"><Icon name="close" size={24} /></Link>
  </header><h1 className={styles.srOnly}>Создать обращение</h1><form ref={formRef} data-step={draft.step} className={styles.form} onSubmit={submit} noValidate aria-busy={saving}>
    <p className={styles.note} aria-live="polite">{stepIndex < 0 ? "Выбор места проблемы" : `Шаг ${stepIndex + 1} из ${steps.length} · ${steps[stepIndex].label}`}</p>
    {draft.step >= 0 && <ol className={styles.steps} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Этапы обращения">{steps.map((step, index) => <li key={step.id} data-reached={step.id <= draft.step || undefined} aria-current={draft.step === step.id ? "step" : undefined}><span>{step.id < draft.step ? "✓" : index + 1}</span>{step.label}</li>)}</ol>}
    <fieldset key={draft.step} className={styles.fields} disabled={saving} data-motion-panel>
      <legend tabIndex={-1}>{draft.step < 0 ? "Где возникла проблема?" : stepTitles[draft.step]}</legend>
      {draft.step < 3 && <p className={styles.houseAddress}><Icon name="pin" size={20} /><span>{house.address}</span></p>}
      {draft.step > 0 && draft.step < 3 && <p className={styles.context}>{draft.step > 1 && `${categoryLabel} · `}{formatLocation(draft.place)} <button type="button" onClick={() => goToStep(-1)}>Изменить место</button></p>}
      {draft.step <= 0 && <><ReportLocationPicker value={draft.place} onChange={place => updateDraft({ place })} details={draft.step === 0} showScopes={draft.step < 0} />{error("place")}</>}
      {draft.step === 1 && <><div className={styles.categories} role="radiogroup" aria-label="Подкатегория" tabIndex={-1} aria-invalid={!!errors.category} aria-describedby={errors.category ? "category-error" : undefined}>
        {categories.map(category => <label key={category.value} className={styles.category}>
          <input type="radio" name="category" value={category.value} checked={draft.category === category.value} onChange={() => { updateDraft({ category: category.value }); setErrors({}); }} />
          <IssueCategoryIcon category={category.value} /><span>{category.label}</span>
        </label>)}
      </div>{error("category")}</>}
      {draft.step === 2 && <>
        <label className={styles.field}>Что случилось?
          <input name="title" placeholder="Течёт труба возле стояка" value={draft.title} onChange={event => { updateDraft({ title: event.target.value }); setErrors(current => ({ ...current, title: "" })); }} maxLength={120} aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
          {error("title")}
        </label>
        <label className={styles.field}>Описание
          <textarea name="description" placeholder="Что вы заметили и когда это началось" value={draft.description} onChange={event => { updateDraft({ description: event.target.value }); setErrors(current => ({ ...current, description: "" })); }} rows={5} maxLength={2000} aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} />
          <span className={styles.characterCount}>{draft.description.length}/2000</span>
          {error("description")}
        </label>
        <PhotoPicker photos={draft.photos} disabled={saving} onChange={photos => updateDraft({ photos })} />
      </>}
      {draft.step === 3 && <div className={styles.review}>
        {([{icon:"pin",label:"Место",value:`${house.address} · ${formatLocation(draft.place)}`,step:-1},{icon:"settings",label:"Подкатегория",value:categoryLabel,step:1},{icon:"receipt",label:"Заголовок",value:draft.title,step:2},{icon:"messages",label:"Описание",value:draft.description,step:2}] as const).map(item => <div className={styles.reviewRow} key={item.label}><span className={styles.reviewIcon}><Icon name={item.icon} size={29} /></span><span><strong>{item.label}</strong><p>{item.value}</p></span><button type="button" onClick={() => goToStep(item.step)}>Изменить</button></div>)}
      </div>}
      {draft.step === 3 && draft.photos.length > 0 && <PhotoPicker photos={draft.photos} />}
      <p className={styles.visibility} aria-live="polite"><Icon name="lock" size={17} /><span>{reportVisibilityLabel(draft.place)}</span></p>
    </fieldset>
    {matches.length > 0 && draft.step >= 1 && <aside className={styles.similar} aria-label="Похожие обращения"><strong>Возможно, об этой проблеме уже сообщили</strong><p>В этом месте есть активные обращения той же категории. Можно открыть их или продолжить создание.</p>{matches.map(issue => <Link key={issue.id} href={"/issues/" + issue.id}>{issue.title}</Link>)}</aside>}
    {failure && <p role="alert" className={styles.error}>{failure}</p>}
    <div className={styles.actions}>
      {draft.step >= 0 ? <button type="button" className={styles.previous} disabled={saving} onClick={() => goToStep(backStep)}>← Назад</button> : <Link className={styles.previous} href={cancelHref}>← Назад</Link>}
      <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Сохраняем…" : draft.step === 3 ? "Отправить обращение" : draft.step === 2 ? "Проверить" : "Продолжить"}</button>
    </div>
    {draft.step === 2 && <div className={styles.draftActions}>
      <Link href={cancelHref} aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }}>Продолжить позже</Link>
      <button type="button" disabled={saving} onClick={async () => { if (await confirm({ title: "Удалить черновик?", description: "Описание и прикреплённые фотографии будут удалены. Восстановить черновик не получится.", confirmLabel: "Удалить", destructive: true })) { resetDraft(); setErrors({}); } }}>Сбросить черновик</button>
      <p className={styles.draftHint}>Черновик останется в этом сеансе. Закрытие приложения, перезагрузка или смена квартиры удалят текст и фотографии.</p>
    </div>}
  </form></>;
}
