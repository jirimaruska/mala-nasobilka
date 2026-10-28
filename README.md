# Malá násobilka

Hra na procvičování malé násobilky pro děti kolem 10 let. Funguje jako aplikace na iPhonu
(přidaná na plochu) i offline.

## Jak se hraje
- Nahoře je příklad, pod ním 4 barevné bubliny s výsledky.
- Bubliny se zmenšují. Je potřeba ťuknout na správnou, než zmizí.
- Za rychlou odpověď je víc bodů. Kolo má 20 příkladů.
- Na konci kola appka ukáže, co se zlepšilo a co ještě procvičit.

## Jak se učí
- Příklady 0–10 × 0–10, celkem 121.
- Každý příklad se sleduje zvlášť, i podle pořadí: 7 × 8 a 8 × 7 jsou dva různé příklady.
- Co nejde, přichází častěji. Co jde rychle, vrací se s rostoucími odstupy
  (spaced repetition), aby se nezapomnělo.
- Násobení nulou je jedno pravidlo, proto v kole nanejvýš 2 příklady s nulou.
  Po odpovědi appka připomene: „Krát nula je vždycky nula.“
- Rodiče vidí v sekci Pro rodiče tabulku 0–10 (11 × 11), nejtěžší příklady a statistiky.

## Instalace na iPhone
1. Otevřít adresu appky v Safari.
2. Sdílet → Přidat na plochu.

## Data
Všechno je uložené jen v telefonu (localStorage, klíč `mala-nasobilka`).
V sekci Pro rodiče jde udělat zálohu do souboru a zase ji nahrát.

## Vývoj
Statický web bez build kroku a bez závislostí. Pravidla projektu jsou v [CLAUDE.md](CLAUDE.md).

```sh
node --test   # testy (najde tests/*.test.mjs)
npx serve .   # lokální server
```
