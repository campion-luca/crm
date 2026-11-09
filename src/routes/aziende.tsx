import { useData } from '@/data/queries'
import { CompanyCard, NewCompanyCard } from '@/features/companies/CompanyCard'

export function CompaniesPage() {
  const view = useData()
  return (
    <div className="flex max-w-[1400px] flex-col gap-[18px]">
      <p className="m-0 text-ink-2">
        Clicca un&apos;azienda per vedere solo i suoi lavori in tutte le viste.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 mobile:grid-cols-1">
        {view.companies.map((c) => (
          <CompanyCard key={c.id} company={c} big />
        ))}
        <NewCompanyCard />
      </div>
    </div>
  )
}
