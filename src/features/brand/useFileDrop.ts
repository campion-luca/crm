import { useState, type DragEvent } from 'react'

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

/** Una sezione intera fa da drop zone per i file trascinati dal computer. */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false)
  return {
    over,
    props: {
      onDragEnter: (e: DragEvent<HTMLElement>) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(true)
      },
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOver(false)
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files)
      },
    },
  }
}
