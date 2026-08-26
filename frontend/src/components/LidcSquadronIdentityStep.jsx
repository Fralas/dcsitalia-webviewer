import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { t } from '../utils/locale';
import { SQUADRON_LOGO_ACCEPT } from '../utils/normalizeSquadronLogo';
import {
  LIDC_AFGHANISTAN_AIRPORTS,
  formatLidcAirportLabel,
  getLidcAirportById,
} from '../config/lidcAfghanistanAirports';
import LidcTheaterMap from './LidcTheaterMap';
import './LidcSquadronIdentityStep.css';

const NAME_MAX = 120;
const DESCRIPTION_MAX = 1200;

export default function LidcSquadronIdentityStep({
  name = '',
  description = '',
  baseId = '',
  logoDataUrl = '',
  logoUploadError = '',
  onNameChange,
  onDescriptionChange,
  onBaseChange,
  onLogoFile,
  onLogoClear,
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedBase = getLidcAirportById(baseId);

  function acceptLogoFile(file) {
    if (!file || typeof onLogoFile !== 'function') return;
    onLogoFile(file);
  }

  function handleFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    acceptLogoFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    acceptLogoFile(event.dataTransfer?.files?.[0]);
  }

  return (
    <div className="lidc-identity">
      <div className="lidc-identity-dossier">
        <div className="lidc-identity-patch-col">
          <button
            type="button"
            className={`lidc-identity-patch ${logoDataUrl ? 'has-logo' : ''} ${isDragOver ? 'is-dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            aria-label={t('lidc.info.logoUpload')}
          >
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="" className="lidc-identity-patch-image" />
            ) : (
              <span className="lidc-identity-patch-empty">
                <ImagePlus size={22} />
                <span>{t('lidc.info.logoDrop')}</span>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={SQUADRON_LOGO_ACCEPT}
              onChange={handleFileInput}
              hidden
            />
          </button>
          {logoUploadError && <div className="lidc-inline-error">{logoUploadError}</div>}
        </div>

        <label className="lidc-identity-field lidc-identity-field--name">
          <span>{t('lidc.info.name')}</span>
          <input
            value={name}
            onChange={(event) => onNameChange?.(event.target.value)}
            maxLength={NAME_MAX}
            placeholder={t('lidc.info.namePlaceholder')}
            autoComplete="off"
          />
          <em>{name.length}/{NAME_MAX}</em>
        </label>

        <label className="lidc-identity-field lidc-identity-field--briefing">
          <span>{t('lidc.info.description')}</span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange?.(event.target.value)}
            rows={8}
            maxLength={DESCRIPTION_MAX}
            placeholder={t('lidc.info.descriptionPlaceholder')}
          />
          <em>{description.length}/{DESCRIPTION_MAX}</em>
        </label>
      </div>

      <section className="lidc-identity-theater" aria-label={t('lidc.info.base')}>
        <div className="lidc-identity-theater-head">
          <span>{t('lidc.info.base')}</span>
          {selectedBase && (
            <strong className="is-set">{formatLidcAirportLabel(selectedBase)}</strong>
          )}
        </div>

        <div className="lidc-identity-map">
          <LidcTheaterMap
            layoutKey="wizard-identity"
            selectedAirportId={baseId}
            onSelectAirport={onBaseChange}
          />
        </div>

        <div className="lidc-identity-bases" role="radiogroup" aria-label={t('lidc.info.base')}>
          {LIDC_AFGHANISTAN_AIRPORTS.map((airport) => {
            const isSelected = airport.id === baseId;
            return (
              <button
                key={airport.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`lidc-identity-base ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onBaseChange?.(airport.id)}
              >
                <span>{airport.name}</span>
                <em>{airport.subtitle}</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
