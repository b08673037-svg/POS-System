export default function Button({
  children,
  variant = "primary",
  type = "button",
  loading = false,
  disabled = false,
  onClick,
  className = "",
  ...rest
}) {
  const classes = `btn btn-${variant} ${className}`.trim();
  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "..." : children}
    </button>
  );
}