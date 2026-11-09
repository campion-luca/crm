import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useApply, useGateway, useSnapshotGetter } from '@/data/queries'
import {
  baseName,
  fontFromFileName,
  isFontFile,
  isLogoFile,
  mimeOf,
  type BrandColor,
  type BrandDoc,
  type BrandFont,
  type BrandLogo,
  type CompanyBrand,
  type FileRef,
  type FontFile,
  type FontRole,
  type LogoBg,
} from '@/lib/brand'
import { newId } from '@/lib/format'
import { undoToast } from '@/lib/undoToast'
import { analyzeLogo, makeAvatar } from './image'

export const useFiles = () => useGateway().files

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** URL da mostrare per un file: firmato e in cache per 45 minuti (scade dopo 60). */
export function useFileUrl(path: string | undefined) {
  const files = useFiles()
  return useQuery({
    queryKey: ['file-url', path],
    queryFn: () => files.url(path!),
    enabled: !!path,
    staleTime: 45 * 60_000,
    gcTime: 50 * 60_000,
    retry: 1,
    meta: { persist: false },
  })
}

type ListKey = 'logos' | 'colors' | 'fonts' | 'docs'
type Item = { id: string }

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))]
const autoWeights = (files: FontFile[]) => uniq(files.map((f) => f.style)).join(', ')

function nextFontRole(fonts: BrandFont[]): FontRole {
  if (!fonts.some((f) => f.role === 'heading')) return 'heading'
  if (!fonts.some((f) => f.role === 'body')) return 'body'
  return 'other'
}

function logoLabel(logos: BrandLogo[], bg: LogoBg): string {
  if (!logos.length) return 'Logo principale'
  if (bg === 'dark' && !logos.some((l) => l.bg === 'dark')) return 'Logo in negativo'
  return `Variante ${logos.length + 1}`
}

const pathsOf = (key: ListKey, item: unknown): string[] => {
  if (key === 'logos') return [(item as BrandLogo).file.path]
  if (key === 'fonts') return (item as BrandFont).files.map((f) => f.path)
  if (key === 'docs') return (item as BrandDoc).file ? [(item as BrandDoc).file!.path] : []
  return []
}

/**
 * Azioni del Setup aziendale. Ogni modifica è una patch di companies.brand calcolata dallo stato
 * più recente (non da quello del render), quindi caricamenti in parallelo non si sovrascrivono.
 */
export function useBrandActions(companyId: string) {
  const apply = useApply()
  const getView = useSnapshotGetter()
  const files = useFiles()

  return useMemo(() => {
    const current = () => getView().companyById.get(companyId)?.brand

    function save(fn: (b: CompanyBrand) => CompanyBrand, message?: string, extra: { color?: string } = {}) {
      const b = current()
      if (!b) return false
      apply(
        [{ op: 'patch', table: 'companies', id: companyId, patch: { brand: fn(b), ...extra } }],
        message ? { message } : {},
      )
      return true
    }

    const dropFiles = (paths: string[]) => {
      if (paths.length) void files.remove(paths).catch(() => undefined)
    }

    /** Elimina con "Annulla": l'annulla lo rimette al suo posto, i file spariscono solo dopo. */
    function removeItem(key: ListKey, itemId: string, message: string) {
      const b = current()
      if (!b) return
      const list = b[key] as Item[]
      const index = list.findIndex((x) => x.id === itemId)
      if (index < 0) return
      const item = list[index]!
      const wasAvatar = key === 'logos' && b.avatarOf === itemId
      const avatar = { avatar: b.avatar, avatarOf: b.avatarOf }
      save((cur) => ({
        ...cur,
        [key]: (cur[key] as Item[]).filter((x) => x.id !== itemId),
        ...(wasAvatar ? { avatar: undefined, avatarOf: undefined } : {}),
      }))
      undoToast(message, {
        onUndo: () =>
          save((cur) => {
            const arr = [...(cur[key] as Item[])]
            if (!arr.some((x) => x.id === itemId)) arr.splice(Math.min(index, arr.length), 0, item)
            return { ...cur, [key]: arr, ...(wasAvatar && !cur.avatar ? avatar : {}) }
          }),
        onCommit: () => dropFiles(pathsOf(key, item)),
      })
    }

    async function uploadAll(list: File[]): Promise<{ file: File; ref: FileRef }[]> {
      const out = await Promise.all(
        list.map(async (file) => {
          try {
            return { file, ref: await files.upload(companyId, file) }
          } catch (e) {
            toast.error(`Caricamento non riuscito: ${errMsg(e)}`)
            return null
          }
        }),
      )
      const ok = out.filter((x): x is { file: File; ref: FileRef } => !!x)
      // azienda eliminata durante il caricamento: i file non servono più
      if (!current()) {
        dropFiles(ok.map((x) => x.ref.path))
        return []
      }
      return ok
    }

    // ------------------------------------------------------------ logo

    async function uploadLogos(list: File[]) {
      const valid = list.filter(isLogoFile)
      if (valid.length < list.length) toast('Per i loghi usa SVG, PNG, JPG o WebP')
      const done = await Promise.all(
        (await uploadAll(valid)).map(async ({ file, ref }) => {
          const typed = new Blob([file], { type: mimeOf(file) })
          const info = await analyzeLogo(typed)
          const avatar = current()?.avatar
            ? undefined
            : await makeAvatar(typed, info.bg).catch(() => undefined)
          const logoId = newId()
          save((cur) => ({
            ...cur,
            logos: [
              ...cur.logos,
              {
                id: logoId,
                label: logoLabel(cur.logos, info.bg),
                file: ref,
                bg: info.bg,
                w: info.w,
                h: info.h,
              },
            ],
            // il primo logo diventa l'avatar dell'azienda
            ...(avatar && !cur.avatar ? { avatar, avatarOf: logoId } : {}),
          }))
          return logoId
        }),
      )
      if (done.length) toast(done.length === 1 ? 'Logo caricato' : `${done.length} loghi caricati`)
    }

    function renameLogo(id: string, label: string) {
      const v = label.trim().slice(0, 80)
      if (!v) return
      save((cur) => ({ ...cur, logos: cur.logos.map((l) => (l.id === id ? { ...l, label: v } : l)) }))
    }

    async function avatarFrom(logo: BrandLogo): Promise<string | undefined> {
      try {
        const blob = await files.download(logo.file.path)
        return await makeAvatar(new Blob([blob], { type: logo.file.mime || blob.type }), logo.bg)
      } catch (e) {
        toast.error(`Avatar non aggiornato: ${errMsg(e)}`)
        return undefined
      }
    }

    async function setLogoBg(id: string, bg: LogoBg) {
      save((cur) => ({ ...cur, logos: cur.logos.map((l) => (l.id === id ? { ...l, bg } : l)) }))
      const b = current()
      const logo = b?.logos.find((l) => l.id === id)
      if (!logo || b?.avatarOf !== id) return
      const avatar = await avatarFrom(logo)
      if (avatar) save((cur) => (cur.avatarOf === id ? { ...cur, avatar } : cur))
    }

    async function setAvatar(id: string | null) {
      if (!id) {
        save(
          (cur) => ({ ...cur, avatar: undefined, avatarOf: undefined }),
          'Avatar rimosso: torna alle iniziali',
        )
        return
      }
      const logo = current()?.logos.find((l) => l.id === id)
      if (!logo) return
      const avatar = await avatarFrom(logo)
      if (avatar) save((cur) => ({ ...cur, avatar, avatarOf: id }), `${logo.label} è il nuovo avatar`)
    }

    // ------------------------------------------------------------ colori

    function saveColor(color: BrandColor, asAppColor = false) {
      const isNew = !current()?.colors.some((c) => c.id === color.id)
      save(
        (cur) => ({
          ...cur,
          colors: isNew ? [...cur.colors, color] : cur.colors.map((c) => (c.id === color.id ? color : c)),
        }),
        asAppColor ? 'Colore salvato e usato per l’azienda' : isNew ? 'Colore aggiunto' : 'Colore salvato',
        asAppColor ? { color: color.hex } : {},
      )
    }

    // ------------------------------------------------------------ font

    function saveFont(font: Omit<BrandFont, 'files'>) {
      const existing = current()?.fonts.find((f) => f.id === font.id)
      save(
        (cur) => ({
          ...cur,
          fonts: existing
            ? cur.fonts.map((f) => (f.id === font.id ? { ...f, ...font } : f))
            : [...cur.fonts, { ...font, files: [] }],
        }),
        existing ? 'Font salvato' : 'Font aggiunto',
      )
    }

    /** File dei font: si raggruppano per famiglia (dal nome del file) o vanno nel font indicato. */
    async function addFontFiles(list: File[], targetId?: string) {
      const valid = list.filter(isFontFile)
      if (valid.length < list.length) toast('Per i font usa WOFF2, WOFF, TTF o OTF')
      const done = await uploadAll(valid)
      if (!done.length) return
      save(
        (cur) => {
          const fonts = [...cur.fonts]
          for (const { file, ref } of done) {
            const { family, style } = fontFromFileName(file.name)
            let i = targetId
              ? fonts.findIndex((f) => f.id === targetId)
              : fonts.findIndex((f) => f.family.toLowerCase() === family.toLowerCase())
            if (i < 0) {
              fonts.push({
                id: newId(),
                family,
                role: nextFontRole(fonts),
                weights: undefined,
                url: undefined,
                files: [],
              })
              i = fonts.length - 1
            }
            const f = fonts[i]!
            const next = [...f.files, { ...ref, style }]
            const keepWeights = f.weights && f.weights !== autoWeights(f.files)
            fonts[i] = { ...f, files: next, weights: keepWeights ? f.weights : autoWeights(next) }
          }
          return { ...cur, fonts }
        },
        done.length === 1 ? 'File del font caricato' : `${done.length} file dei font caricati`,
      )
    }

    function removeFontFile(fontId: string, path: string) {
      const font = current()?.fonts.find((f) => f.id === fontId)
      const index = font?.files.findIndex((x) => x.path === path) ?? -1
      if (!font || index < 0) return
      const file = font.files[index]!
      const edit = (fn: (files: FontFile[]) => FontFile[]) =>
        save((cur) => ({
          ...cur,
          fonts: cur.fonts.map((f) => (f.id === fontId ? { ...f, files: fn(f.files) } : f)),
        }))
      edit((fs) => fs.filter((x) => x.path !== path))
      undoToast(`${file.name} eliminato`, {
        onUndo: () =>
          edit((fs) =>
            fs.some((x) => x.path === path) ? fs : [...fs.slice(0, index), file, ...fs.slice(index)],
          ),
        onCommit: () => dropFiles([path]),
      })
    }

    // ------------------------------------------------------------ tono e documenti

    function saveGuide(g: Pick<CompanyBrand, 'payoff' | 'tone' | 'hashtags' | 'guidelines'>) {
      save((cur) => ({ ...cur, ...g }), 'Tono e linee guida salvati')
    }

    async function addDocFiles(list: File[]) {
      const done = await uploadAll(list)
      if (!done.length) return
      save(
        (cur) => ({
          ...cur,
          docs: [
            ...cur.docs,
            ...done.map(({ file, ref }) => ({
              id: newId(),
              label: baseName(file.name),
              url: undefined,
              file: ref,
            })),
          ],
        }),
        done.length === 1 ? 'Documento caricato' : `${done.length} documenti caricati`,
      )
    }

    function saveDoc(doc: BrandDoc) {
      const isNew = !current()?.docs.some((d) => d.id === doc.id)
      save(
        (cur) => ({
          ...cur,
          docs: isNew ? [...cur.docs, doc] : cur.docs.map((d) => (d.id === doc.id ? doc : d)),
        }),
        isNew ? 'Link aggiunto' : 'Salvato',
      )
    }

    async function download(ref: FileRef) {
      try {
        const blob = await files.download(ref.path)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = ref.name
        document.body.append(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } catch (e) {
        toast.error(`Download non riuscito: ${errMsg(e)}`)
      }
    }

    return {
      uploadLogos,
      renameLogo,
      setLogoBg,
      setAvatar,
      removeLogo: (id: string) => removeItem('logos', id, 'Logo eliminato'),
      saveColor,
      removeColor: (id: string) => removeItem('colors', id, 'Colore eliminato'),
      saveFont,
      addFontFiles,
      removeFontFile,
      removeFont: (id: string) => removeItem('fonts', id, 'Font eliminato'),
      saveGuide,
      addDocFiles,
      saveDoc,
      removeDoc: (id: string) => removeItem('docs', id, 'Documento eliminato'),
      download,
    }
  }, [apply, getView, files, companyId])
}

export type BrandActions = ReturnType<typeof useBrandActions>
