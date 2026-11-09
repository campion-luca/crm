import { Code2 } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { brandCss } from '@/lib/brand'
import { copyText } from '@/lib/hooks'
import type { Company } from '@/lib/types'
import { ColorSection } from './ColorSection'
import { DocsSection } from './DocsSection'
import { FontSection } from './FontSection'
import { GuideSection } from './GuideSection'
import { LogoSection } from './LogoSection'
import { useBrandActions } from './useBrand'

/**
 * Tab "Setup aziendale" del pannello azienda: logo, colori, font, tono di voce e documenti.
 * Ogni sezione accetta i file trascinati dal computer.
 */
export function BrandSetup({ company }: { company: Company }) {
  const b = company.brand
  const actions = useBrandActions(company.id)

  // un file lasciato fuori dalle sezioni non deve aprire il file nella scheda (e chiudere l'app)
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs text-pretty text-ink-3">
          Trascina i file nelle sezioni per caricarli. Clicca un colore o un codice per copiarlo.
        </span>
        <Button
          size="sm"
          disabled={!b.colors.length && !b.fonts.length}
          title="Palette e font come variabili CSS, da incollare in un foglio di stile"
          onClick={() => void copyText(brandCss(b), 'Variabili CSS copiate')}
        >
          <Code2 /> Copia variabili CSS
        </Button>
      </div>
      <LogoSection brand={b} companyName={company.name} actions={actions} />
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-4 narrow:grid-cols-1">
        <ColorSection brand={b} companyId={company.id} appColor={company.color} actions={actions} />
        <FontSection brand={b} companyId={company.id} actions={actions} />
      </div>
      <div className="grid grid-cols-2 items-start gap-4 narrow:grid-cols-1">
        <GuideSection brand={b} companyId={company.id} />
        <DocsSection brand={b} companyId={company.id} actions={actions} />
      </div>
    </>
  )
}
