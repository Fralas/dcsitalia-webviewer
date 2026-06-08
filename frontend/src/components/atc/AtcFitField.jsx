import { useCallback, useLayoutEffect, useRef } from 'react';

const DEFAULT_MAX = 14;
const DEFAULT_MIN = 7;

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
  multiline = false,
}) {
  const wrapRef = useRef(null);
  const measureRef = useRef(null);

  const syncHeight = useCallback((el) => {
    if (!el || !multiline) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 14)}px`;
  }, [multiline]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    const el = measureRef.current;
    if (!wrap || !el) return;

    const maxWidth = wrap.clientWidth - 1;
    if (!String(value || '').length) {
      el.style.fontSize = '';
      if (multiline) el.style.height = '1.1em';
      return;
    }

    let size = maxFontSize;
    el.style.fontSize = `${size}px`;

    if (multiline) {
      el.style.whiteSpace = 'nowrap';
      el.style.wordBreak = 'normal';
      while (size > minFontSize && el.scrollWidth > maxWidth) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      el.style.whiteSpace = 'pre-wrap';
      el.style.wordBreak = 'break-word';
      syncHeight(el);
      return;
    }

    while (size > minFontSize && el.scrollWidth > maxWidth) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [value, maxFontSize, minFontSize, multiline, syncHeight]);

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
    syncHeight(event.target);
  };

  const handleBlur = (event) => {
    onBlur?.();
    onCommit?.(event.target.value);
  };

  const fieldClass = multiline ? 'atc-fit-field__textarea' : 'atc-fit-field__input';

  if (!editable) {
    return (
      <span ref={wrapRef} className={`atc-fit-field atc-fit-field--readonly ${multiline ? 'atc-fit-field--multiline' : ''} ${className}`.trim()}>
        <span ref={measureRef} className={`atc-fit-field__text ${fieldClass}`}>{value}</span>
      </span>
    );
  }

  const InputTag = multiline ? 'textarea' : 'input';

  return (
    <span
      ref={wrapRef}
      className={`atc-fit-field ${multiline ? 'atc-fit-field--multiline' : ''} ${className}`.trim()}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      <InputTag
        ref={measureRef}
        className={fieldClass}
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
        rows={multiline ? 1 : undefined}
        {...(multiline ? {} : { type: 'text' })}
      />
    </span>
  );
}
