//+------------------------------------------------------------------+
//|                                    BTC_MilliScalper_v4.mq5       |
//|  Scalping tick BTCUSD – Version ultra-simple qui PREND des trades|
//|  Fix définitif des 0 trades (v2 + v3)                            |
//+------------------------------------------------------------------+
#property copyright "mariuskwa-afk / Grok"
#property link      "https://github.com/mariuskwa-afk/robotdescalping"
#property version   "4.00"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

CTrade        trade;
CPositionInfo pos;

//=== PARAMÈTRES ===
input group "=== SIGNAL (très simple) ==="
input double MinMoveDollar     = 4.0;     // Mouvement minimum en $ pour entrer
input int    TicksForSignal    = 6;       // Nombre de ticks à regarder

input group "=== TRADES ==="
input double LotSize           = 0.01;
input int    MaxPositions      = 2;
input int    Magic             = 20261040;
input int    CooldownSeconds   = 5;

input group "=== SORTIES ==="
input double TP_Dollar         = 5.0;
input double SL_Dollar         = 7.5;
input int    MaxSecondsOpen    = 35;
input double BE_Trigger        = 2.0;

input group "=== FILTRES ==="
input double MaxSpreadDollar   = 12.0;
input double MaxDrawdownPct    = 20.0;
input bool   UseTimer          = true;
input int    TimerMs           = 20;

input group "=== DEBUG ==="
input bool   VerboseLogs       = true;
input bool   ShowComment       = true;

//=== GLOBALS ===
double   peakEquity = 0;
datetime lastLossTime = 0;
datetime lastEntryTime = 0;
int      digits;
double   point;

double   lastPrices[50];
int      priceCount = 0;
int      priceIdx = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringFind(_Symbol, "BTC") < 0 && StringFind(_Symbol, "XBT") < 0)
   {
      Alert("Attache uniquement sur BTCUSD !");
      return INIT_FAILED;
   }

   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(50);
   trade.SetTypeFilling(ORDER_FILLING_IOC);

   point  = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   peakEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   ArrayInitialize(lastPrices, 0);
   priceCount = 0;
   priceIdx = 0;

   if(UseTimer) EventSetMillisecondTimer(TimerMs);

   Print("=== BTC MilliScalper v4 démarré | Lot=", LotSize, " | Magic=", Magic, " ===");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

void OnTimer() { Manage(); Entry(); }
void OnTick()  { Manage(); Entry(); }

//+------------------------------------------------------------------+
void Entry()
{
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity > peakEquity) peakEquity = equity;
   double dd = (peakEquity > 0) ? (peakEquity - equity) / peakEquity * 100.0 : 0;
   if(dd >= MaxDrawdownPct)
   {
      CloseAll("DD max");
      return;
   }

   if(TimeCurrent() - lastLossTime < CooldownSeconds) return;
   if(TimeCurrent() - lastEntryTime < 3) return; // anti spam

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double spread = ask - bid;
   if(spread > MaxSpreadDollar) return;

   // Remplir buffer
   double mid = (ask + bid) / 2.0;
   lastPrices[priceIdx] = mid;
   priceIdx = (priceIdx + 1) % 50;
   if(priceCount < 50) priceCount++;

   if(priceCount < TicksForSignal + 2) return;

   // Calcul du mouvement
   int idx1 = (priceIdx - 1 + 50) % 50;
   int idx2 = (priceIdx - TicksForSignal + 50) % 50;
   double move = lastPrices[idx1] - lastPrices[idx2];

   int nBuy  = Count(POSITION_TYPE_BUY);
   int nSell = Count(POSITION_TYPE_SELL);
   if(nBuy + nSell >= MaxPositions) return;

   // === SIGNAL LONG ===
   if(move > MinMoveDollar && nBuy == 0)
   {
      if(OpenBuy(ask))
      {
         lastEntryTime = TimeCurrent();
         if(VerboseLogs) Print(">>> BUY | move = ", DoubleToString(move, 2), " $");
      }
   }
   // === SIGNAL SHORT ===
   else if(move < -MinMoveDollar && nSell == 0)
   {
      if(OpenSell(bid))
      {
         lastEntryTime = TimeCurrent();
         if(VerboseLogs) Print(">>> SELL | move = ", DoubleToString(move, 2), " $");
      }
   }

   if(ShowComment) UpdateComment(equity, dd, spread, move);
}

//+------------------------------------------------------------------+
void Manage()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!pos.SelectByIndex(i)) continue;
      if(pos.Symbol() != _Symbol || pos.Magic() != Magic) continue;

      double profit = pos.Profit() + pos.Swap() + pos.Commission();

      // Breakeven
      if(profit >= BE_Trigger)
      {
         double open = pos.PriceOpen();
         double newSL = (pos.PositionType() == POSITION_TYPE_BUY) ?
                        NormalizeDouble(open + point * 2, digits) :
                        NormalizeDouble(open - point * 2, digits);

         if((pos.PositionType() == POSITION_TYPE_BUY && (pos.StopLoss() < newSL || pos.StopLoss() == 0)) ||
            (pos.PositionType() == POSITION_TYPE_SELL && (pos.StopLoss() > newSL || pos.StopLoss() == 0)))
         {
            trade.PositionModify(pos.Ticket(), newSL, pos.TakeProfit());
         }
      }

      // Timeout
      if((int)(TimeCurrent() - pos.Time()) >= MaxSecondsOpen)
      {
         trade.PositionClose(pos.Ticket());
         if(profit < 0) lastLossTime = TimeCurrent();
         if(VerboseLogs) Print("Timeout | profit = ", DoubleToString(profit, 2));
      }
   }
}

//+------------------------------------------------------------------+
bool OpenBuy(double price)
{
   double tp = NormalizeDouble(price + TP_Dollar, digits);
   double sl = NormalizeDouble(price - SL_Dollar, digits);
   bool ok = trade.Buy(LotSize, _Symbol, price, sl, tp, "v4 BUY");
   if(!ok && VerboseLogs) Print("BUY échoué: ", trade.ResultRetcodeDescription());
   return ok;
}

bool OpenSell(double price)
{
   double tp = NormalizeDouble(price - TP_Dollar, digits);
   double sl = NormalizeDouble(price + SL_Dollar, digits);
   bool ok = trade.Sell(LotSize, _Symbol, price, sl, tp, "v4 SELL");
   if(!ok && VerboseLogs) Print("SELL échoué: ", trade.ResultRetcodeDescription());
   return ok;
}

//+------------------------------------------------------------------+
int Count(ENUM_POSITION_TYPE t)
{
   int c = 0;
   for(int i = PositionsTotal()-1; i >= 0; i--)
      if(pos.SelectByIndex(i) && pos.Symbol()==_Symbol && pos.Magic()==Magic && pos.PositionType()==t) c++;
   return c;
}

void CloseAll(string reason)
{
   for(int i = PositionsTotal()-1; i >= 0; i--)
      if(pos.SelectByIndex(i) && pos.Symbol()==_Symbol && pos.Magic()==Magic)
         trade.PositionClose(pos.Ticket());
   Print("CloseAll: ", reason);
}

void UpdateComment(double eq, double dd, double spread, double move)
{
   string s = "════════════════════════════\n";
   s += "  BTC MilliScalper v4\n";
   s += "════════════════════════════\n";
   s += StringFormat("Equity : %.2f\n", eq);
   s += StringFormat("DD     : %.1f%%\n", dd);
   s += StringFormat("Spread : $%.2f\n", spread);
   s += StringFormat("Move   : %.1f $\n", move);
   s += StringFormat("BUY:%d  SELL:%d\n", Count(POSITION_TYPE_BUY), Count(POSITION_TYPE_SELL));
   s += "════════════════════════════";
   Comment(s);
}
//+------------------------------------------------------------------+
