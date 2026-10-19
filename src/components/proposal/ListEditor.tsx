"use client";

export function ListEditor({
  label,
  values,
  onChange,
  addLabel = "Add"
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel?: string;
}) {
  return (
    <fieldset className="list-editor">
      <legend className="lbl">{label}</legend>
      {values.map((value, index) => (
        <div className="list-editor-row" key={`${label}-${index}`}>
          <input
            type="text"
            value={value}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <button
            className="btn btn-ghost btn-compact"
            type="button"
            onClick={() => onChange(values.filter((_, item) => item !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button className="btn btn-ghost btn-compact" type="button" onClick={() => onChange([...values, ""])}>
        {addLabel}
      </button>
    </fieldset>
  );
}
