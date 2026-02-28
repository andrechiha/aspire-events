import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const MAX_WAVES = 10;

export default function WavesEditor({ waves, onChange, errors }) {
  const totalCapacity = waves.reduce((s, w) => s + (parseInt(w.capacity, 10) || 0), 0);

  const update = (idx, field, val) => {
    const next = [...waves];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  const add = () => {
    if (waves.length >= MAX_WAVES) return;
    onChange([...waves, { label: `Wave ${waves.length + 1}`, price: '', capacity: '' }]);
  };

  const remove = (idx) => {
    if (waves.length <= 1) return;
    onChange(waves.filter((_, i) => i !== idx));
  };

  return (
    <div className="waves-editor">
      <div className="waves-editor__header">
        <span className="waves-editor__badge">
          Total capacity: <strong>{totalCapacity}</strong>
        </span>
      </div>

      <div className="waves-editor__table">
        <div className="waves-editor__row waves-editor__row--head">
          <span className="we-col we-col--num">#</span>
          <span className="we-col we-col--label">Wave Name</span>
          <span className="we-col we-col--price">Price</span>
          <span className="we-col we-col--qty">Tickets</span>
          <span className="we-col we-col--action"></span>
        </div>

        {waves.map((w, i) => {
          const rowErr = errors?.[i];
          return (
            <div
              className={`waves-editor__row ${rowErr ? 'waves-editor__row--invalid' : ''}`}
              key={i}
            >
              <span className="we-col we-col--num">{i + 1}</span>

              <div className="we-col we-col--label">
                <input
                  className="we-input"
                  placeholder="e.g. Early Bird"
                  value={w.label}
                  onChange={(e) => update(i, 'label', e.target.value)}
                />
              </div>

              <div className="we-col we-col--price">
                <div className="we-input-wrap">
                  <span className="we-input-prefix">$</span>
                  <input
                    className="we-input we-input--prefixed"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={w.price}
                    onChange={(e) => update(i, 'price', e.target.value)}
                  />
                </div>
              </div>

              <div className="we-col we-col--qty">
                <input
                  className="we-input"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={w.capacity}
                  onChange={(e) => update(i, 'capacity', e.target.value)}
                />
              </div>

              <div className="we-col we-col--action">
                {waves.length > 1 && (
                  <button type="button" className="we-remove" onClick={() => remove(i)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {waves.length < MAX_WAVES && (
        <button type="button" className="waves-editor__add" onClick={add}>
          <Plus size={15} /> Add Wave
        </button>
      )}
    </div>
  );
}
