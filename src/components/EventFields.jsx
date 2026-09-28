import {eventFields} from './premiumEvents.mjs';
export function EventFields() {
  return (
    <div className="form-grid">
      {eventFields.map(([name, label, type, required]) => (
        <label className="form-field" key={name}>
          <span>{label}</span>
          {type === "textarea" ? (
            <textarea name={name} rows={3} required={required} />
          ) : (
            <input
              name={name}
              type={type}
              required={required}
              accept={type === "file" ? "image/*" : undefined}
            />
          )}
        </label>
      ))}
    </div>
  );
}
