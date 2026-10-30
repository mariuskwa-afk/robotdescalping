//+------------------------------------------------------------------+
//|                              BTC_MilliScalper_v5_FORCE.mq5       |
//|  VERSION DE DIAGNOSTIC – FORCE des trades pour tester            |
//|  l’exécution dans le Strategy Tester Axi                         |
//+------------------------------------------------------------------+
#property copyright "mariuskwa-afk / Grok"
#property version   "5.00"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

CTrade        trade;
CPositionInfo pos;

input double LotSize         = 0.01;
input int    Magic           = 20261050;
input double TP_Dollar       = 6.0;
input double SL_Dollar       = 9.0;
input int    MaxSecondsOpen  = 45;
input int    ForceEveryMin   = 15;      // Force un trade toutes les X minutes
input double MinMoveDollar   = 2.5;     // Seuil très bas
input bool   VerboseLogs     = true;

double peakEquity = 0;
datetime lastForceTime = 0;
datetime lastEntryTime = 0;
int digits;
double point;

double lastPrices[30];
int priceCount = 0, priceIdx = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(Magic);
   trade.SetDeviationInPoints(50);
   trade.SetTypeFilling(ORDER_FILLING_IOC);

   point  = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   peakEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   ArrayInitialize(lastPrices, 0);
   Print("=== BTC MilliScalper v5 FORCE – DIAGNOSTIC ===");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { Comment(""); }

void OnTick()
{
   // Gestion des positions ouvertes
   for(int i = PositionsTotal()-1; i >= 0; i--)
   {
      if(!pos.SelectByIndex(i)) continue;
      if(pos.Symbol() != _Symbol || pos.Magic() != Magic) continue;

      double profit = pos.Profit() + pos.Swap() + pos.Commission();
      if((int)(TimeCurrent() - pos.Time()) >= MaxSecondsOpen)
      {
         trade.PositionClose(pos.Ticket());
         if(VerboseLogs) Print("Timeout fermé | profit=", DoubleToString(profit,2));
      }
   }

   // === BUFFER ===
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double mid = (ask + bid) / 2.0;

   lastPrices[priceIdx] = mid;
   priceIdx = (priceIdx + 1) % 30;
   if(priceCount < 30) priceCount++;

   if(priceCount < 8) return;

   // Calcul mouvement
   int idx1 = (priceIdx - 1 + 30) % 30;
   int idx2 = (priceIdx - 6 + 30) % 30;
   double move = lastPrices[idx1] - lastPrices[idx2];

   int totalPos = 0;
   for(int i=PositionsTotal()-1; i>=0; i--)
      if(pos.SelectByIndex(i) && pos.Symbol()==_Symbol && pos.Magic()==Magic) totalPos++;

   if(totalPos >= 2) return;
   if(TimeCurrent() - lastEntryTime < 8) return; // anti spam

   // === 1. SIGNAL NORMAL (très sensible) ===
   if(move > MinMoveDollar)
   {
      if(OpenBuy(ask))
      {
         lastEntryTime = TimeCurrent();
         if(VerboseLogs) Print("BUY signal normal | move=", DoubleToString(move,2));
         return;
      }
   }
   else if(move < -MinMoveDollar)
   {
      if(OpenSell(bid))
      {
         lastEntryTime = TimeCurrent();
         if(VerboseLogs) Print("SELL signal normal | move=", DoubleToString(move,2));
         return;
      }
   }

   // === 2. FORCE TRADE toutes les X minutes (diagnostic) ===
   if(TimeCurrent() - lastForceTime >= ForceEveryMin * 60)
   {
      // Alterne buy / sell
      static bool nextBuy = true;
      if(nextBuy)
      {
         if(OpenBuy(ask))
         {
            lastForceTime = TimeCurrent();
            lastEntryTime = TimeCurrent();
            nextBuy = false;
            if(VerboseLogs) Print(">>> FORCE BUY (diagnostic)");
         }
      }
      else
      {
         if(OpenSell(bid))
         {
            lastForceTime = TimeCurrent();
            lastEntryTime = TimeCurrent();
            nextBuy = true;
            if(VerboseLogs) Print(">>> FORCE SELL (diagnostic)");
         }
      }
   }
}

//+------------------------------------------------------------------+
bool OpenBuy(double price)
{
   double tp = NormalizeDouble(price + TP_Dollar, digits);
   double sl = NormalizeDouble(price - SL_Dollar, digits);
   bool ok = trade.Buy(LotSize, _Symbol, price, sl, tp, "v5 FORCE BUY");
   if(!ok && VerboseLogs) Print("BUY failed: ", trade.ResultRetcodeDescription());
   return ok;
}

bool OpenSell(double price)
{
   double tp = NormalizeDouble(price - TP_Dollar, digits);
   double sl = NormalizeDouble(price + SL_Dollar, digits);
   bool ok = trade.Sell(LotSize, _Symbol, price, sl, tp, "v5 FORCE SELL");
   if(!ok && VerboseLogs) Print("SELL failed: ", trade.ResultRetcodeDescription());
   return ok;
}
//+------------------------------------------------------------------+
