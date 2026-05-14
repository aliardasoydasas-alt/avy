import { BriefcaseBusiness } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'

export const HoldingsPlaceholderPanel = () => (
  <Panel title="Varliklarim" subtitle="Portfoy modulu bu alana baglanacak">
    <div className="mini-list__label">
      <BriefcaseBusiness size={18} />
      <strong>Faz 2 hazir</strong>
    </div>
    <StateCard description="Bu alan bir sonraki fazda coin ve hisse ekleme, miktar girme, ortalama maliyet hesaplama ve portfoy grafigi ile doldurulacak. Menu akisi simdiden hazir ve ayni ekrandan acilabiliyor." title="Portfoy akisi bekleniyor" />
  </Panel>
)
