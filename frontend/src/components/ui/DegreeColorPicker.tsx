import React from 'react';
import type { DegreeOption } from '../../types';

/**
 * Two usage modes:
 *   1. Grade picker (new): degrees + selectedId
 *   2. Stage color picker (legacy): value + degree
 */
interface GradeModeProps {
  degrees: DegreeOption[];
  selectedId: string;
  onChange: (id: string) => void;
  orientation?: 'vertical' | 'horizontal';
  /** legacy props absent */
  value?: never;
  degree?: never;
  labelAr?: never;
  labelEn?: never;
}

interface LegacyModeProps {
  /** hex or CSS var string */
  value: string;
  onChange: (color: string) => void;
  degree?: number;
  labelAr?: string;
  labelEn?: string;
  /** new props absent */
  degrees?: never;
  selectedId?: never;
  orientation?: never;
}

type DegreeColorPickerProps = GradeModeProps | LegacyModeProps;

const ACCENT_SWATCHES = [
  'var(--dccp-sw-red)',
  'var(--dccp-sw-teal)',
  'var(--dccp-sw-blue)',
  'var(--dccp-sw-green)',
  'var(--dccp-sw-purple)',
  'var(--dccp-sw-gold)',
] as const;

export const DegreeColorPicker: React.FC<DegreeColorPickerProps> = (props) => {
  // ---- Legacy mode (VisualWorkflowEditor) ----
  if ('value' in props && props.value !== undefined) {
    const { value, onChange, degree = 1, labelAr, labelEn } = props;
    const isVar = value.startsWith('var(');
    const displayColor = isVar ? 'var(--border-medium)' : value;

    return (
      <div className="degree-color-picker">
        {/* Degree pip strip — shows which stage degree this color belongs to */}
        <div className="dccp-degree-strip" aria-label={`${labelAr ?? ''} degree`}>
          {[1, 2, 3, 4, 5, 6].map(d => (
            <div key={d} className={`dccp-degree-pip${d === degree ? ' dccp-degree-pip--active' : ''}`} />
          ))}
        </div>

        <div className="dccp-body">
          {/* Preset swatches — six preset accent colors for quick pick */}
          <div className="dccp-swatches">
            {ACCENT_SWATCHES.map((swatch, i) => (
              <button
                key={i}
                type="button"
                className={`dccp-swatch dccp-accent-${(i + 1) as 1|2|3|4|5|6}${!isVar && value === swatch ? ' dccp-swatch--active' : ''}`}
                style={{ background: swatch }}
                onClick={() => onChange(swatch)}
                title={`Accent ${i + 1}`}
              />
            ))}
          </div>

          {/* Hex input */}
          <div className="dccp-input-row">
            <div className="dccp-preview" style={{ background: displayColor }} />
            <input
              type="text"
              className="form-control dccp-hex-input"
              value={value}
              dir="ltr"
              onChange={e => onChange(e.target.value.trim())}
              placeholder="#0E6B65 or CSS var"
            />
          </div>

          {/* Live preview card */}
          <div className="dccp-card-preview">
            <div className="dccp-card-dot" style={{ background: value }} />
            <div className="dccp-card-text">
              <span>{labelAr ?? labelEn ?? 'Degree'}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--eng-font-mono)' }}>
                {value}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Grade picker mode (EditInitiativeModal) ----
  const { degrees, selectedId, onChange, orientation = 'vertical' } = props as GradeModeProps;
  const sortedDegrees = [...degrees].sort((a, b) => a.order - b.order);
  const selected = sortedDegrees.find(d => d.id === selectedId);
  const isHorizontal = orientation === 'horizontal';
  const containerClass = isHorizontal
    ? 'degree-color-picker degree-color-picker--horizontal'
    : 'degree-color-picker';

  return (
    <div className={containerClass}>
      {/* Degree pip strip — left in LTR, right in RTL via CSS flip */}
      <div className="dccp-degree-strip" aria-label="Degree selection">
        {sortedDegrees.map(deg => {
          const isActive = deg.id === selectedId;
          return (
            <button
              key={deg.id}
              type="button"
              className={`dccp-degree-pip${isActive ? ' dccp-degree-pip--active' : ''}`}
              style={{ background: deg.color }}
              onClick={() => onChange(deg.id)}
              title={`${deg.labelAr} / ${deg.labelEn}`}
            >
              <span className="dccp-pip-label">{deg.labelEn}</span>
            </button>
          );
        })}
      </div>

      <div className="dccp-body">
        {/* Accent swatches shown when a degree is active */}
        {selected && (
          <>
            <div className="dccp-accent-label">لون التمييز / Accent Color</div>
            <div className="dccp-swatches">
              {ACCENT_SWATCHES.map((swatch, i) => (
                <button
                  key={i}
                  type="button"
                  className={`dccp-swatch dccp-accent-${(i + 1) as 1|2|3|4|5|6} dccp-swatch--active`}
                  style={{ background: swatch }}
                  title={`Accent ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Live preview card */}
        {selected && (
          <div className="dccp-card-preview">
            <div className="dccp-card-dot" style={{ background: selected.color }} />
            <div className="dccp-card-text">
              <span>{isHorizontal ? selected.labelEn : selected.labelAr}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selected.color}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
