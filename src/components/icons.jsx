/* ============================================================
   图标（内联 SVG，与旧版逐条一致）
   ============================================================ */

export function IconPin(props) {
  return (
    <svg className="i-pin" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconChevron(props) {
  return (
    <svg className="chev" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function IconSearch(props) {
  return (
    <svg className="i-search" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="10.5" cy="10.5" r="6.6" />
      <path d="M15.4 15.4 L20.5 20.5" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h16M4 12h16M4 17h11" />
    </svg>
  );
}

export function IconList(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

export function IconShuffle(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 6.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMinus(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
