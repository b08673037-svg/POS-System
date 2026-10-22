export default function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  required = false,
  ...rest
}) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={name}>
          {label}
          {required && <span className="required"> *</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={error ? "input input-error" : "input"}
        {...rest}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}