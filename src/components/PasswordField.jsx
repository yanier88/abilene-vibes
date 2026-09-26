import { useEffect, useState } from "react";

export default function PasswordField({ autoComplete, disabled }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); }, [autoComplete]);
  return <label>Password
    <span className="pe-password-field">
      <input aria-label="Password" name="password" type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} required disabled={disabled} />
      <button className="pe-password-toggle" type="button" disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(value => !value)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  </label>;
}
