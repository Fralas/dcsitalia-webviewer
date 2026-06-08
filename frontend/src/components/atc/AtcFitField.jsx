import { useCallback, useLayoutEffect, useRef } from 'react';

const DEFAULT_MAX = 14;
const DEFAULT_MIN = 9;

export default function AtcFitField({
  value = '',
  onChange,
  onCommit,
  onFocus,
  onBlur,
  editable = false,
  className = '',
  maxLength,
  uppercase = false,
  placeholder = '',
  inputMode,
  maxFontSize = DEFAULT_MAX,
  minFontSize = DEFAULT_MIN,
}) {
  const wrapRef = useRef(null);
  const measureRef = useRef(null);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    const el = measureRef.current;
    if (!wrap || !el) return;

    const base = Math.min(maxFontSize, parseFloat(getComputedStyle(el).fontSize) || maxFontSize);
    let size = base;
    el.style.fontSize = `${size}px`;

    if (!String(value || '').length) {
      el.style.fontSize = '';
      return;
    }

    const maxWidth = wrap.clientWidth - 1;
    while (size > minFontSize && el.scrollWidth > maxWidth) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [value, maxFontSize, minFontSize]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fit]);

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  const handleChange = (event) => {
    let next = event.target.value;
    if (uppercase) next = next.toUpperCase();
    onChange?.(next);
  };

  const handleBlur = (event) => {
    onBlur?.();
    onCommit?.(event.target.value);
  };

  if (!editable) {
    return (
      <span ref={wrapRef} className={`atc-fit-field atc-fit-field--readonly ${className}`.trim()}>
        <span ref={measureRef} className="atc-fit-field__text">{value}</span>
      </span>
    );
  }

  return (
    <span
      ref={wrapRef}
      className={`atc-fit-field ${className}`.trim()}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      <input
        ref={measureRef}
        className="atc-fit-field__input"
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={(event) => {
          stopBubble(event);
          onFocus?.();
        }}
        onBlur={handleBlur}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
        autoComplete="off"
      />
    </span>
  );
}
