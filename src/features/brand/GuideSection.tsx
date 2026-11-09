import { MessageSquareQuote, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, Module } from '@/components/ui/Module'
import type { CompanyBrand } from '@/lib/brand'
import { openModal } from '@/stores/modals'
import { LabeledBlock } from './parts'

const tagsOf = (s: string) =>
  s
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))

/** Payoff, tono di voce, hashtag e regole d'uso: tutto quello che serve per scrivere un post. */
export function GuideSection({ brand, companyId }: { brand: CompanyBrand; companyId: string }) {
  const { payoff, tone, hashtags, guidelines } = brand
  const empty = !payoff && !tone && !hashtags && !guidelines
  const edit = () => openModal({ kind: 'brandGuide', companyId })
  return (
    <Module
      title="Tono e linee guida"
      icon={<MessageSquareQuote />}
      iconTone="company"
      right={
        !empty && (
          <Button size="sm" onClick={edit}>
            Modifica
          </Button>
        )
      }
    >
      {empty ? (
        <EmptyState title="Ancora niente">
          Payoff, tono di voce, hashtag e regole d’uso del logo: quello che serve per scrivere un post senza
          riaprire il brand book.
          <div className="mt-4">
            <Button variant="primary" onClick={edit}>
              <Plus /> Compila
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4 px-[18px] pt-3.5 pb-4">
          {payoff && (
            <LabeledBlock label="Payoff" copy={payoff}>
              <p className="m-0 text-[17px] leading-snug font-bold text-balance">“{payoff}”</p>
            </LabeledBlock>
          )}
          {tone && (
            <LabeledBlock label="Tono di voce" copy={tone}>
              <p className="m-0 text-[13.5px] leading-[1.55] whitespace-pre-line text-ink-2">{tone}</p>
            </LabeledBlock>
          )}
          {hashtags && (
            <LabeledBlock label="Hashtag" copy={tagsOf(hashtags).join(' ')}>
              <div className="flex flex-wrap gap-1.5">
                {tagsOf(hashtags).map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="rounded-full bg-[color-mix(in_srgb,var(--c)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-ink"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </LabeledBlock>
          )}
          {guidelines && (
            <LabeledBlock label="Linee guida" copy={guidelines}>
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px] leading-[1.55] whitespace-pre-line text-ink-2">
                {guidelines}
              </div>
            </LabeledBlock>
          )}
        </div>
      )}
    </Module>
  )
}
