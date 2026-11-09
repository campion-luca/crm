import { Copy, Download, FileText, FolderOpen, Link2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Module } from '@/components/ui/Module'
import { Skeleton } from '@/components/ui/Skeleton'
import { fileExt, fmtBytes, type BrandDoc, type CompanyBrand } from '@/lib/brand'
import { copyText } from '@/lib/hooks'
import { normUrl } from '@/lib/profile'
import { openModal } from '@/stores/modals'
import { DropArea, DropTile, FileButton } from './parts'
import type { BrandActions } from './useBrand'

const hostOf = (url: string) => {
  try {
    return new URL(normUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Brand book, template e presentazioni: file caricati o link (Drive, Figma, Canva…). */
export function DocsSection({
  brand,
  companyId,
  actions,
}: {
  brand: CompanyBrand
  companyId: string
  actions: BrandActions
}) {
  const [busy, setBusy] = useState(0)
  const upload = async (files: File[]) => {
    setBusy((n) => n + files.length)
    try {
      await actions.addDocFiles(files)
    } finally {
      setBusy((n) => n - files.length)
    }
  }
  const addLink = () => openModal({ kind: 'brandLink', companyId })

  return (
    <DropArea onFiles={(f) => void upload(f)}>
      {(over) => (
        <Module
          title="Documenti e risorse"
          icon={<FolderOpen />}
          iconTone="company"
          count={brand.docs.length || undefined}
          right={
            <>
              <FileButton size="sm" onFiles={(f) => void upload(f)}>
                <Upload /> File
              </FileButton>
              <Button size="sm" onClick={addLink}>
                <Plus /> Link
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-1.5 p-3">
            {brand.docs.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {brand.docs.map((d) => (
                  <DocRow key={d.id} doc={d} companyId={companyId} actions={actions} />
                ))}
              </ul>
            )}
            {Array.from({ length: busy }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 px-2.5 py-2"
                aria-hidden
              >
                <Skeleton className="size-8 bg-surface" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40 bg-surface" />
                  <Skeleton className="h-3 w-24 bg-surface" />
                </div>
              </div>
            ))}
            <DropTile
              onFiles={(f) => void upload(f)}
              over={over}
              icon={<FileText />}
              className={brand.docs.length ? 'py-4' : 'py-8'}
              title={brand.docs.length ? 'Carica altri file' : 'Brand book, template, presentazioni'}
              hint="Trascina qui i file (fino a 25 MB) o aggiungi un link a Drive, Figma o Canva."
            />
          </div>
        </Module>
      )}
    </DropArea>
  )
}

function DocRow({ doc, companyId, actions }: { doc: BrandDoc; companyId: string; actions: BrandActions }) {
  const file = doc.file
  const label = doc.label || file?.name || (doc.url ? hostOf(doc.url) : 'Documento')
  const url = doc.url ? normUrl(doc.url) : ''
  return (
    <li className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 py-1.5 pr-1 pl-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--c)_18%,transparent)] text-(--c) [&_svg]:size-4"
      >
        {file ? <FileText /> : <Link2 />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {file ? (
          <button
            type="button"
            onClick={() => void actions.download(file)}
            className="truncate text-left font-semibold hover:text-accent"
          >
            {label}
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-semibold text-ink hover:text-accent"
          >
            {label}
          </a>
        )}
        <span className="truncate num text-[11.5px] text-ink-3">
          {file ? `${fileExt(file.name).toUpperCase() || 'File'} · ${fmtBytes(file.size)}` : hostOf(url)}
        </span>
      </div>
      {file ? (
        <IconButton
          aria-label={`Scarica ${label}`}
          title="Scarica"
          onClick={() => void actions.download(file)}
        >
          <Download />
        </IconButton>
      ) : (
        <>
          <IconButton
            aria-label={`Copia il link ${label}`}
            title="Copia il link"
            onClick={() => void copyText(url)}
          >
            <Copy />
          </IconButton>
          <IconButton
            aria-label={`Modifica ${label}`}
            title="Modifica"
            onClick={() => openModal({ kind: 'brandLink', companyId, docId: doc.id })}
          >
            <Pencil />
          </IconButton>
        </>
      )}
      <IconButton
        aria-label={`Elimina ${label}`}
        title="Elimina"
        onClick={() => actions.removeDoc(doc.id)}
        className="hover:text-danger"
      >
        <Trash2 />
      </IconButton>
    </li>
  )
}
