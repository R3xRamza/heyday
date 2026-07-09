import { forwardRef, useLayoutEffect, useRef } from 'react';

const BASE_PX = 14;
const MIN_PX = 10;

const TwoLineFitText = forwardRef(function TwoLineFitText(
  { children, className = '', as: Tag = 'span', style, ...rest },
  forwardedRef
) {
  const innerRef = useRef(null);

  const setRef = (node) => {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = `${BASE_PX}px`;
      el.classList.remove('line-clamp-2');

      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      const maxHeight = lineHeight * 2;

      let size = BASE_PX;
      while (size > MIN_PX) {
        el.style.fontSize = `${size}px`;
        if (el.scrollHeight <= maxHeight + 0.5) break;
        size -= 0.5;
      }
      if (size <= MIN_PX) {
        el.style.fontSize = `${MIN_PX}px`;
      }

      el.classList.add('line-clamp-2');
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const cell = el.closest('td');
    if (cell) ro.observe(cell);
    return () => ro.disconnect();
  }, [children]);

  return (
    <Tag
      ref={setRef}
      className={`block min-w-0 w-full leading-snug break-words line-clamp-2 overflow-hidden ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default TwoLineFitText;
