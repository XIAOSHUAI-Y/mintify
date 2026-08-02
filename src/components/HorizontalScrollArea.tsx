import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';

type ScrollEdges = 'none' | 'start' | 'middle' | 'end';

/**
 * 横向列表不常驻滚动条，而是在确实溢出时根据当前位置显示边缘渐隐。
 * 这样既能提示还有内容，也不会在已经滚到末尾时继续给出错误方向提示。
 */
export default function HorizontalScrollArea({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>('none');

  const updateEdges = useCallback(() => {
    const element = ref.current;
    if (!element || element.scrollWidth <= element.clientWidth + 1) {
      setEdges('none');
      return;
    }

    const atStart = element.scrollLeft <= 1;
    const atEnd = Math.ceil(element.scrollLeft + element.clientWidth) >= element.scrollWidth - 1;
    setEdges(atStart ? 'start' : atEnd ? 'end' : 'middle');
  }, []);

  useEffect(() => {
    updateEdges();
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('scroll', updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    window.addEventListener('resize', updateEdges);
    return () => {
      element.removeEventListener('scroll', updateEdges);
      observer.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges]);

  return (
    <div
      ref={ref}
      data-scroll-edges={edges}
      className={`horizontal-scroll-hint ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
