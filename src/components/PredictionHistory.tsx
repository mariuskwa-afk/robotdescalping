import { CheckCircle2, XCircle, Clock, History, TrendingUp, TrendingDown, BarChart3, MinusCircle } from 'lucide-react';

interface PredictionRecord {
  id: string;
  symbol: string;
  signal: string;
  confidence: number;
  price_at_prediction: number;
  price_at_expiry: number | null;
  result: string;
  created_at: string;
}

export function PredictionHistory({ history, wins, losses, draws, winRate }: {
  history: PredictionRecord[];
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}) {
  if (history.length === 0) {
    return (
      <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-12 text-center">
        <History className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-gray-400 font-medium mb-2">Aucune prediction enregistree</h3>
        <p className="text-gray-600 text-sm">Lancez le mode Live dans l'onglet Prediction pour commencer a suivre les resultats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total" value={history.length} icon={BarChart3} tone="text-sky-400" />
        <SummaryCard label="Wins" value={wins} icon={TrendingUp} tone="text-emerald-400" />
        <SummaryCard label="Losses" value={losses} icon={TrendingDown} tone="text-red-400" />
        {draws > 0 && <SummaryCard label="Egalites" value={draws} icon={MinusCircle} tone="text-gray-400" />}
        <SummaryCard label="Win rate" value={`${winRate}%`} icon={CheckCircle2} tone="text-amber-400" />
      </div>

      {/* History table */}
      <div className="bg-[#11151c] rounded-2xl border border-gray-800/60 p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-sky-400" />
          Dernieres previsions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Heure</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Signal</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Confiance</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Prix entree</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Prix sortie</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Resultat</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="py-3 px-3 text-gray-400 text-xs">
                    {new Date(h.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                      h.signal === 'UP' ? 'text-emerald-400 bg-emerald-500/10' : h.signal === 'DOWN' ? 'text-red-400 bg-red-500/10' : 'text-gray-400 bg-gray-500/10'
                    }`}>
                      {h.signal === 'UP' ? <><TrendingUp className="w-3 h-3" /> HAUT</> : h.signal === 'DOWN' ? <><TrendingDown className="w-3 h-3" /> BAS</> : 'ATTENDRE'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-300">{h.confidence}%</td>
                  <td className="py-3 px-3 text-right text-gray-300 font-mono text-xs">${h.price_at_prediction.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td className="py-3 px-3 text-right text-gray-300 font-mono text-xs">
                    {h.price_at_expiry ? `$${h.price_at_expiry.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {h.result === 'WIN' && <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> WIN</span>}
                    {h.result === 'LOSS' && <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" /> LOSS</span>}
                    {h.result === 'DRAW' && <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-medium"><MinusCircle className="w-3.5 h-3.5" /> EGALITE</span>}
                    {h.result === 'PENDING' && <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium"><Clock className="w-3.5 h-3.5" /> ...</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: {
  label: string; value: string | number; icon: typeof BarChart3; tone: string;
}) {
  return (
    <div className="bg-[#11151c] rounded-xl border border-gray-800/60 p-4">
      <Icon className={`w-5 h-5 mb-2 ${tone}`} />
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className={`font-bold text-xl ${tone}`}>{value}</p>
    </div>
  );
}
