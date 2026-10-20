"use client";
import { useState } from "react";
import { SectionPage } from "@/shared/ui/navigation";
import { RequestState } from "@/shared/ui/navigation/request-state";
import Link from "next/link";
import { commonZones, formatLocation, useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { initialReportStep } from "@/entities/issue/model/issue-draft";
import { cameraIssueContext } from "../model/camera-issue-context";
import { useCameras } from "../model/api";
import { CameraStatus } from "./camera-status";
import styles from "./cameras.module.css";
import { CameraPreview } from "./camera-preview";
import { Icon } from "@/shared/ui/icon";
import { useOnboarding } from "@/features/onboarding/onboarding";
import { cameraVisibilityLabel, filterCameras, type CameraFilters } from "../model/camera";

const emptyFilters: CameraFilters = { type: "all", entrance: "", floor: "", zone: "" };

export function CamerasPage() {
  const { preparing } = useOnboarding();
  const { house } = useHouseSelection();
  if (preparing) return <SectionPage title="Камеры" description="Личные и общедоступные камеры" backHref="/" backLabel="На главную" />;
  return <LoadedCamerasPage key={house.id} />;
}

function LoadedCamerasPage() {
  const state = useCameras();
  const { house } = useHouseSelection();
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = [filters.type !== "all", filters.entrance, filters.floor, filters.zone].filter(Boolean).length;
  const cameras = filterCameras(state.data ?? [], filters);
  const updateLocationFilter = (name: "entrance" | "floor" | "zone", value: string) => setFilters(previous => ({ ...previous, [name]: value }));
  return <SectionPage title="Камеры" description="Личные и общедоступные камеры" backHref="/" backLabel="На главную">
    <p className={styles.address}><Icon name="pin" size={20} />{house.address}</p>
    <div className={styles.toolbar}><Link href="/cameras/new" className={styles.addButton}>＋ Добавить камеру</Link><button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="camera-filters" onClick={() => setFiltersOpen(open => !open)}><Icon name="settings" size={20} /><span>Фильтры{filterCount > 0 ? ` · ${filterCount}` : ""}</span></button></div>
    <fieldset id="camera-filters" className={styles.filters} hidden={!filtersOpen}>
      <legend>Фильтры камер</legend>
      <div className={styles.locationFilters}>
        <label className={styles.cameraType}>Тип камер<select value={filters.type} onChange={event => {
          const type = event.target.value;
          if (type === "all" || type === "mine" || type === "public") setFilters(previous => ({ ...previous, type }));
        }}><option value="all">Все камеры</option><option value="mine">Мои камеры</option><option value="public">Общедоступные</option></select></label>
        <label>Подъезд<select value={filters.entrance} onChange={event => updateLocationFilter("entrance", event.target.value)}><option value="">Все подъезды</option>{Array.from({ length: house.entrances }, (_, i) => <option key={i + 1} value={i + 1}>Подъезд {i + 1}</option>)}</select></label>
        <label>Этаж<select value={filters.floor} onChange={event => updateLocationFilter("floor", event.target.value)}><option value="">Все этажи</option>{Array.from({ length: house.floors }, (_, i) => <option key={i + 1} value={i + 1}>Этаж {i + 1}</option>)}</select></label>
        <label>Место<select value={filters.zone} onChange={event => updateLocationFilter("zone", event.target.value)}><option value="">Все места</option>{Object.entries(commonZones).map(([zone, title]) => <option key={zone} value={zone}>{title}</option>)}<option value="apartment">Квартира</option></select></label>
      </div>
      <button type="button" className={styles.resetFilters} onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
    </fieldset>
    <RequestState {...state} />
    <div className={styles.results}>{state.data && <p className={styles.hint} role="status">Камер: {cameras.length}</p>}<button type="button" className={styles.refreshList} disabled={state.loading} onClick={state.reload} aria-label="Обновить список камер"><Icon name="refresh" size={20} /></button></div>
    <ul className={styles.list} aria-label="Камеры дома">{cameras.map(camera => <li key={camera.id}>
      <Link data-tour="camera-card" href={`/cameras/${camera.id}`} className={styles.camera}>
        <CameraPreview camera={camera} compact />
        <span className={styles.overlayStatus}><CameraStatus status={camera.status} /></span><div className={styles.cardBody}><div><h2>{camera.name}</h2><p>{camera.place ? formatLocation(camera.place) : camera.note}</p><p className={styles.accessLabel}>{camera.mine ? "Моя · " : ""}{cameraVisibilityLabel(camera)}</p></div><Icon name="arrow" size={19} /></div>
      </Link>
    </li>)}</ul>
    {!state.loading && !state.error && !cameras.length && <p>Камер по выбранным условиям нет. Измените фильтры или добавьте свою камеру.</p>}
  </SectionPage>;
}

export function CameraDetailsPage({ id }: { id: string }) {
  const { preparing } = useOnboarding();
  const { house } = useHouseSelection();
  if (preparing) return <SectionPage title="Камера" description={house.address} backHref="/cameras" backLabel="Все камеры" />;
  return <LoadedCameraDetailsPage key={`${house.id}:${id}`} id={id} />;
}

function LoadedCameraDetailsPage({ id }: { id: string }) {
  const state = useCameras();
  const { house, select } = useHouseSelection();
  const { updateDraft } = useIssues();
  const camera = state.data?.find(item => item.id === id);
  return <SectionPage title={camera?.name ?? "Камера"} description={`${house.address.replace(/^г\.\s*Казань,?\s*ул\.\s*/, "")}${camera?.note ? ` · ${camera.note}` : ""}`} backHref="/cameras" backLabel="Все камеры">
    <RequestState {...state} />
    {camera && <><aside className={styles.accessNotice} aria-label="Доступ к камере"><strong>{cameraVisibilityLabel(camera)}</strong>{camera.place && <p>{formatLocation(camera.place)}</p>}{camera.visibility === "private" && <p>Эта камера доступна только вам.</p>}{camera.moderationStatus === "pending" && <p>Заявка отправлена в УК. Пока камера видна только вам. После одобрения её смогут смотреть жители дома.</p>}{camera.moderationStatus === "rejected" && <p>Камеру видите только вы. Причина отклонения: {camera.moderationReason}</p>}{camera.mine && camera.visibility === "public" && <button type="button" onClick={state.reload} disabled={state.loading}>Проверить решение УК</button>}</aside><div className={styles.detail}><CameraPreview key={camera.id} camera={camera} /><aside className={styles.about}><Link data-tour="camera-report" href={`/issues/new?from=camera&camera=${encodeURIComponent(camera.id)}`} onNavigate={() => {
      const context = cameraIssueContext(camera, house);
      if (context) {
        select(context.place);
        updateDraft({ ...context, step: initialReportStep(context.place) });
      } else {
        updateDraft({ category: "", step: 0 });
      }
    }}><Icon name="messages" />Сообщить о проблеме</Link></aside></div></>}
    {!state.loading && !state.error && !camera && <p>Камера не найдена.</p>}
  </SectionPage>;
}
