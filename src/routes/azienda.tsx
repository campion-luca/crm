import { getRouteApi, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useData } from '@/data/queries'
import { useUi } from '@/stores/ui'
import { CompanyDashboard, type DashTab } from '@/features/companies/CompanyDashboard'

const route = getRouteApi('/app/aziende/$id')

/** /aziende/:id — pannello dell'azienda. Imposta l'ambito così le altre viste restano filtrate. */
export function CompanyPage() {
  const { id } = route.useParams()
  const { tab } = route.useSearch()
  const navigate = route.useNavigate()
  const view = useData()
  const company = view.companyById.get(id)

  useEffect(() => {
    if (!company) return
    const { scope, setScope } = useUi.getState()
    if (scope.companyId !== company.id) {
      const keepFolder = scope.folderId && view.folderById.get(scope.folderId)?.company_id === company.id
      setScope({ companyId: company.id, folderId: keepFolder ? scope.folderId : null })
    }
  }, [company, view.folderById])

  if (!company) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-card border border-dashed border-line p-7 text-center text-ink-2">
        <b className="mb-1 block text-[15px] text-ink">Azienda non trovata</b>
        <p className="mt-0 mb-3 text-[13px]">Potrebbe essere stata eliminata.</p>
        <Link to="/aziende" className="font-bold text-accent">
          Vai alle aziende
        </Link>
      </div>
    )
  }

  return (
    <CompanyDashboard
      company={company}
      tab={tab ?? 'panoramica'}
      onTab={(t: DashTab) =>
        void navigate({ search: { tab: t === 'panoramica' ? undefined : t }, replace: true })
      }
    />
  )
}
