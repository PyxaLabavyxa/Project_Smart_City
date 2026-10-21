"use client";
import { useState } from "react";
import { SectionPage } from "@/shared/ui/navigation";
import { RequestState } from "@/shared/ui/navigation/request-state";
import Link from "next/link";
import { LocationFilters, changeLocationFilter, formatLocation, useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { initialReportStep } from "@/entities/issue/model/issue-draft";
import { cameraIssueContext } from "../model/camera-issue-context";
import { useCameras } from "../model/api";
import styles from "./cameras.module.css";
import { CameraPreview } from "./camera-preview";
import { Icon } from "@/shared/ui/icon";
import { RefreshButton } from "@/shared/ui/refresh-button";
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
  const updateLocationFilter = (name: "entrance" | "floor" | "zone", value: string) => setFilters(previous => changeLocationFilter(previous, name, value));
  return <SectionPage title="Камеры" description="Личные и общедоступные камеры" backHref="/" backLabel="На главную">
    <p className={styles.address}><Icon name="pin" size={20} />{house.address}</p>
    <div className={styles.toolbar}><Link href="/cameras/new" className={styles.addButton}><Icon name="plus" size={18} />Добавить</Link><button type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="camera-filters" onClick={() => setFiltersOpen(open => !open)}><Icon name="settings" size={20} /><span>Фильтры</span>{filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}</button><RefreshButton className={styles.refreshList} loading={state.loading} onRefresh={state.reload} iconSize={20} aria-label="Обновить список камер" /></div>
    <fieldset id="camera-filters" className={styles.filters} hidden={!filtersOpen} data-motion-panel>
      <legend>Фильтры камер</legend>
      <div className={styles.locationFilters}>
        <label className={styles.cameraType}>Тип камер<select value={filters.type} onChange={event => {
          const type = event.target.value;
          if (type === "all" || type === "mine" || type === "public") setFilters(previous => ({ ...previous, type }));
        }}><option value="all">Все камеры</option><option value="mine">Мои камеры</option><option value="public">Общедоступные</option></select></label>
        <LocationFilters house={house} value={filters} onChange={updateLocationFilter} />
      </div>
      <button type="button" className={styles.resetFilters} onClick={() => setFilters(emptyFilters)}>Сбросить фильтры</button>
    </fieldset>
    <RequestState {...state} loading={state.loading && !state.data} />
    <ul className={styles.list} aria-label="Камеры дома" aria-busy={state.loading}>{cameras.map(camera => <li key={camera.id}>
      <Link data-tour="camera-card" href={`/cameras/${camera.id}`} className={styles.camera}>
        <CameraPreview camera={camera} compact />
        <div className={styles.cardBody}><div><h2>{camera.name}</h2><p>{camera.place ? formatLocation(camera.place) : camera.note}</p><p className={styles.accessLabel}>{camera.mine ? "Моя · " : ""}{cameraVisibilityLabel(camera)}</p></div><Icon name="arrow" size={19} /></div>
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
    <RequestState {...state} loading={state.loading && !state.data} />
    {camera && <><aside className={styles.accessNotice} aria-label="Доступ к камере"><strong>{cameraVisibilityLabel(camera)}</strong>{camera.place && <p>{formatLocation(camera.place)}</p>}{camera.visibility === "private" && <p>Эта камера доступна только вам.</p>}{camera.moderationStatus === "pending" && <p>Заявка отправлена в УК. Пока камера видна только вам. После одобрения её смогут смотреть жители дома.</p>}{camera.moderationStatus === "rejected" && <p>Камеру видите только вы. Причина отклонения: {camera.moderationReason}</p>}</aside><div className={styles.detail}><CameraPreview key={camera.id} camera={camera} /><aside className={styles.about}><Link data-tour="camera-report" href={`/issues/new?from=camera&camera=${encodeURIComponent(camera.id)}`} onNavigate={() => {
      const context = cameraIssueContext(camera, house);
      if (context) {
        select(context.place);
        updateDraft({ ...context, step: initialReportStep(context.place) });
      } else {
        updateDraft({ category: "", step: 0 });
      }
    }}><Icon name="messages" />Сообщить о проблеме</Link>{camera.mine && <Link className={styles.cameraSettings} href={`/cameras/${camera.id}/settings`}><Icon name="settings" size={18} />Настройки камеры</Link>}</aside></div></>}
    {!state.loading && !state.error && !camera && <p>Камера не найдена.</p>}
  </SectionPage>;
}
