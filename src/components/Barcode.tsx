import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface Props {
  value: string
  format?: 'CODE128' | 'EAN13' | 'CODE39'
  height?: number
  width?: number
  displayValue?: boolean
  className?: string
  color?: string
  background?: string
}

/**
 * Renders a scannable barcode as inline SVG. Falls back to CODE128 when the
 * value does not satisfy the stricter symbologies (e.g. a 12-digit EAN input).
 */
export function Barcode({
  value,
  format = 'CODE128',
  height = 46,
  width = 1.6,
  displayValue = true,
  className,
  color = '#0f172a',
  background = 'transparent',
}: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !value) return
    const opts = {
      height, width, displayValue, background, lineColor: color,
      margin: 4, fontSize: 12, font: 'ui-monospace, monospace', textMargin: 2,
    }
    try {
      JsBarcode(el, value, { ...opts, format })
    } catch {
      try {
        JsBarcode(el, value, { ...opts, format: 'CODE128' })
      } catch {
        el.innerHTML = ''
      }
    }
  }, [value, format, height, width, displayValue, color, background])

  return <svg ref={ref} className={className} />
}
