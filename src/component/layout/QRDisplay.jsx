import {react} from 'react'
import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function QRDisplay({ value, size = 180 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#0f0f11', light: '#ffffff' },
    })
  }, [value, size])

  return <canvas ref={canvasRef} width={size} height={size} />
}