# Prognoza metryk bez danych — symulowani gracze i model lejka

Portale oceniają grę trzema liczbami: **konwersją** (ilu graczy, którzy weszli, gra co najmniej minutę), **średnim czasem sesji** i **powrotami następnego dnia (D1)**. Prawdziwe liczby da dopiero Basic Launch na CrazyGames (co najmniej 7 dni i 500 rozgrywek). Do tego czasu wersje porównujemy tym narzędziem: symulowani nowi gracze grają kampanię, a model lejka zamienia ich wyniki w przewidywane metryki.

**Najważniejsze zastrzeżenie:** wartości bezwzględne zależą od założeń (tabela niżej). Narzędzie służy do porównywania wersji i szukania ścian trudności, nie do obiecywania wyniku.

## 1. Symulowani gracze — `HUMANSIM()` w `tools/harness.js`

Bot testowy z testu regresji jest nieśmiertelny i reaguje natychmiast. Symulowany gracz tego nie robi:
- zauważa żołnierza dopiero po czasie reakcji;
- często zatrzymuje się, żeby celować, i czasem waha się bez powodu;
- skacze z opóźnieniem i unika tylko części pocisków;
- czasem wpada do dołu;
- strzela tylko do tego, co widzi (skała i ściany zasłaniają, ziemia na tym samym poziomie nie);
- po kilku sekundach odpuszcza cel, którego nie może trafić;
- wspina się po drabinie, gdy utknie;
- wraca po cel misji, który strzałka pokazuje za nim.

| Profil | Udział w ruchu portalu | Reakcja | Staje do strzału | Unik: kule / pociski wybuchowe | Wahanie |
|---|---|---|---|---|---|
| nowicjusz (np. dziecko na telefonie) | 35% | 0,6 s | 60% | 8% / 40% | 0,25/s |
| przeciętny gracz portalu | 45% | 0,4 s | 40% | 30% / 65% | 0,12/s |
| wprawny (gra w platformówki) | 20% | 0,25 s | 20% | 60% / 85% | 0,05/s |

Każdy symulowany gracz zaczyna od pustego zapisu i gra kampanię od misji 1. Przegraną misję powtarza (do 4 prób), a pieniądze wydaje na najtańsze ulepszenie, jak nowy gracz. Wynik to jeden wiersz na próbę: czas, śmierci z przyczyną i miejscem, jeńcy, wynik (ukończona / porażka / utknięcie po 6 minutach).

```js
await HUMANSIM({ profiles: ['rookie', 'casual', 'skilled'], players: 4 })  // ok. 6 min
await HUMANBOSS({ level: 9, tries: 6 })   // jedna misja (np. boss), zapis z połowy kampanii
```

## 2. Model lejka — `tools/funnel.py`

Model składa 20 000 sesji z prób symulowanych graczy i dokłada zachowania typowe dla ruchu z portali:

| Założenie | Wartość |
|---|---|
| wyjście na ekranie tytułowym | 3% |
| „to nie moja gra” w pierwszej minucie | 10% |
| znudzenie w trakcie gry | 2,5% na minutę, rośnie o 0,08 pkt proc. z każdą minutą |
| wyjście ze złości po stracie bohatera | 1,5% |
| wyjście po 1. / 2. / 3. / 4. porażce z rzędu | 25 / 40 / 55 / 65% |
| wyjście na ekranie wyników (naturalny koniec) | 8%, +3%, gdy leci reklama (portale: najwyżej 1 na ok. 3 min) |
| czas człowieka a bota | ×1,25 (czytanie, rozglądanie się) |
| D1 wg długości sesji | <2 min 2%, 2–5 min 6%, 5–10 min 10%, 10–20 min 16%, 20–40 min 22%, więcej 25%; ukończona kampania ×0,6 |
| panel dostawy z jutrzejszą nagrodą w 1. sesji (od 1.19) | D1 ×1,1 |

**Utknięcia bota.** Bot nie znajduje drogi na piętro kwatery pułkownika (misje z zamachem, zawsze ok. 56% mapy). Czasem nie trafia też na drabinkę ewakuacji. Człowiek ze strzałką celu zwykle sobie poradzi. Model liczy więc dwa warianty:
- `--timeouts fail`: człowiek też się poddaje (dolna granica);
- `--timeouts pass`: człowiek znajduje drogę po minucie szukania (wariant główny).

```bash
python tools/funnel.py docs/metrics/sim_1.18.json docs/metrics/sim_1.19.json --drop-after --timeouts pass
```

## 3. Wyniki: 1.18 → 1.19

| Metryka (cel portali) | 1.18 | 1.19 | dolna granica 1.18 → 1.19 |
|---|---|---|---|
| konwersja, ≥ 1 min gry (80%+) | 84% | 84% | 85% → 83% |
| średni czas sesji (10+ min) | 10,7 min | **11,2 min** | 9,3 → 9,1 min |
| D1 (10–15%) | 10,9% | **12,4%** | 10,5 → 11,3% |

Pewniejsze od tych liczb są twarde dane z symulacji (12 graczy na wersję, ok. 220 prób):

| | 1.18 | 1.19 |
|---|---|---|
| śmierci od spadającego gruzu | 134 | 13 |
| śmierci od zderzenia z bossem | 14 | 9 (i każda to już tylko 1 HP) |
| przegrane misje poza misją 10 | 15 | 5 |
| misja 10, test celowany: wygrane / utraceni bohaterowie na próbę | 1 z 18 / 5,6 | 5 z 18 / 4,1 |
| odsetek graczy, którzy przechodzą M3 / M4 / M5 (model) | 51 / 41 / 28% | 59 / 47 / 33% |

## 4. Co pokazała symulacja

- **Konwersja jest bezpieczna.** Jedno kliknięcie do gry, pierwszy wybuch po ok. 3 s, misja 1 trwa ok. minuty. Liczba zależy głównie od założeń o odbiciach, a nie od gry. Ryzyka są poza modelem: reklama przed grą na portalu i ekran „obróć telefon” na komórkach.
- **Czas sesji to najsłabsza metryka.** Sesja kończy się głównie na ścianach trudności: misja 3 (ucieczka), misja 4 (pułkownik na piętrze), misja 5 (czołg), misja 10 (śmigłowiec). Drugi powód to zwykłe odejścia na ekranie wyników.
- **Najczęstsze zgony w 1.18 wyglądały na niesprawiedliwe:**
  - spadający gruz zabijał jednym trafieniem, także w misji 1;
  - dotknięcie czołgu zabijało od razu;
  - pocisk czołgu i rakiety śmigłowca spadały bez zapowiedzi, choć moździerz miał czerwony znacznik.
- **D1 zależy od długości pierwszej sesji i od powodu, żeby wrócić.** Codzienna dostawa była tylko na ekranie tytułowym. Gracz, który przechodzi misje przyciskiem NEXT, nie widział jej w pierwszej sesji.

## 5. Decyzje w 1.19

| Zmiana | Metryka | Dlaczego |
|---|---|---|
| gruz i zderzenie z bossem: 1 HP i odrzut zamiast śmierci | czas sesji | pierwsza i druga przyczyna „zgonów bez winy”; mniej porażek = mniej wyjść |
| znaczniki pocisku czołgu oraz rakiet i bomb śmigłowca; mniej rakiet w salwie | czas sesji | uczciwy unik; największa ściana kampanii |
| +1 życie w kolejnej próbie po porażce (max +2), „RETRY +1 LIFE” | czas sesji | po porażce odchodzi 25–40% graczy; obietnica łatwiejszej próby zatrzymuje część z nich, a ściana daje się przejść |
| podpowiedź „TIP:” po śmierci (a przy bossie: jak go pokonać) | czas sesji, D1 | śmierć uczy zamiast tylko zabierać życie (bot się nie uczy, więc model tego nie liczy) |
| dostawa po pierwszej misji dnia: „DAY 1 — TOMORROW +$60” | D1 | gracz już w 1. sesji dowiaduje się, że jutro czeka większa nagroda |

## 6. Co dalej (w kolejności)

1. **Basic Launch na CrazyGames**: prawdziwe metryki zastąpią model. Porównaj je z tabelą w punkcie 3 i popraw założenia w `ASSUME`.
2. **Playtest z 2–3 nowymi graczami** skupiony na miejscach z symulacji (lista w [PLAYTEST.md](PLAYTEST.md)). Zwłaszcza: czy gracz sam znajduje pułkownika w misji 4 i czy wchodzi na filary w walce ze śmigłowcem.
3. Jeśli średni czas sesji wyjdzie poniżej 10 min: spłaszczyć ściany wskazane przez raport F3 (np. pułkownik zbiega na parter, gdy gracz jest blisko; krótsza arena misji 10).
4. Jeśli D1 wyjdzie poniżej 10%: dać mocniejszy powód do powrotu, np. rotujące modyfikatory misji dnia albo skrzynię po 7 dniach serii z nagrodą, którą widać (skórka bohatera).
5. Jeśli na telefonach konwersja wyjdzie wyraźnie niższa niż na komputerach: tryb pionowy zamiast ekranu „obróć telefon” (duża praca).

## 7. Ograniczenia

- Bot się nie uczy: podpowiedzi po śmierci i znaczniki działają na ludzi, a na bota nie. Model zaniża więc efekt tych zmian.
- Bot słabo nawiguje (piętro kwatery pułkownika, filary w arenie śmigłowca). Misje 4, 8, 13 i 10 wychodzą w symulacji trudniejsze niż dla ludzi.
- 12 symulowanych graczy na wersję to mała próba. Różnice rzędu kilku dziesiątych minuty mieszczą się w szumie. Kierunek zmian pokazują twarde liczby z punktu 3 (zgony, porażki, wygrane).
- Założenia o odejściach pochodzą z ogólnej wiedzy o grach przeglądarkowych, nie z danych tej gry. Po Basic Launch trzeba je skalibrować.
