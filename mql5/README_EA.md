# BTC MilliScalper v4

Expert Advisor MQL5 de **scalping ultra-court** (tick) pour **BTCUSD**.

## Auteur
- [mariuskwa-afk](https://github.com/mariuskwa-afk)
- Développé avec Grok (xAI)

## Versions
- v1 : EMA + RSI (perdant)
- v2/v3 : Momentum tick (0 trade dans le tester)
- **v4** : Version ultra-simple qui prend des trades

## Installation
1. Télécharge `mql5/Experts/BTC_MilliScalper_v4.mq5`
2. Place-le dans `MQL5/Experts/`
3. Compile (F7)
4. Attache sur **BTCUSD M1**

## Paramètres recommandés
- `MinMoveDollar` = 4.0 (baisser à 3.0 si trop peu de trades)
- `TP_Dollar` = 5.0
- `SL_Dollar` = 7.5
- `MaxSecondsOpen` = 35

## Backtest
Utilise **Every tick based on real ticks**.

## Avertissement
Risque de perte totale. Teste toujours en démo.

## Licence
MIT
