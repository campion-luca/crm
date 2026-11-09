import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Props<T> {
  items: T[]
  getKey: (item: T, index: number) => string
  estimate: (item: T) => number
  render: (item: T, index: number) => ReactNode
  /**
   * Elemento che scorre (la colonna principale o il contenitore della lista). È un elemento e non una
   * ref: al primo montaggio la ref del contenitore non è ancora collegata quando partono gli effect
   * dei figli, e il virtualizer resterebbe senza elemento (lista vuota).
   */
  scrollElement: HTMLElement | null
  /** sotto questa soglia la lista si disegna intera */
  threshold?: number
}

/** Lista che si virtualizza da sola quando supera ~150 righe. */
export function VirtualList<T>({ items, threshold = 150, ...rest }: Props<T>) {
  if (items.length <= threshold) {
    return (
      <>
        {items.map((it, i) => (
          <Fragment key={rest.getKey(it, i)}>{rest.render(it, i)}</Fragment>
        ))}
      </>
    )
  }
  return <Virtualized items={items} {...rest} />
}

function Virtualized<T>({ items, getKey, estimate, render, scrollElement }: Omit<Props<T>, 'threshold'>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [margin, setMargin] = useState(0)

  // distanza della lista dall'inizio del contenitore che scorre
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !scrollElement) return
    const measure = () =>
      setMargin(
        list.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top + scrollElement.scrollTop,
      )
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(scrollElement)
    return () => ro.disconnect()
  }, [scrollElement])

  // TanStack Virtual restituisce funzioni non memoizzabili dal React Compiler: è atteso
  // eslint-disable-next-line react-hooks/incompatible-library
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: (i) => estimate(items[i]!),
    getItemKey: (i) => getKey(items[i]!, i),
    overscan: 10,
    scrollMargin: margin,
  })

  return (
    <div ref={listRef} role="presentation" style={{ height: v.getTotalSize(), position: 'relative' }}>
      {v.getVirtualItems().map((vi) => (
        <div
          key={vi.key}
          role="presentation"
          data-index={vi.index}
          ref={v.measureElement}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${vi.start - margin}px)`,
          }}
        >
          {render(items[vi.index]!, vi.index)}
        </div>
      ))}
    </div>
  )
}
