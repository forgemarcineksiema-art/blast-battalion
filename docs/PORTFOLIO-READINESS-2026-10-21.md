# Blast Battalion — gotowość do portfolio

Przegląd z 21.10.2026. Punkt wyjścia: `f260b357052854554c3d8080fd9385d10c8816ed`
(wersja gry 1.33.1). Poprawki w tym przeglądzie podnoszą wersję do 1.33.2.

**Wniosek:** działający projekt własny nadaje się do prywatnej prezentacji i dalszego
playtestu. Nie ma jeszcze podstaw, by opisywać go jako ukończoną, zbalansowaną grę
albo zweryfikowane wdrożenie na portalach. Najlepszym dowodem w portfolio jest
uruchamialna gra oraz krótki materiał z jej rzeczywistej symulacji.

## Sprawdzone kroki i stan doświadczenia

Ocena dotyczy widocznego działania, a nie wyłącznie lektury kodu.

| Krok | Stan | Dowód i zakres |
|---|---|---|
| 1. Start zwykłego buildu | Działa | Produkcyjny HTML uruchomił misję; [zrzut](portfolio-evidence/2026-10-21/blast-01-baseline-start.jpg). |
| 2. Ruch, strzał i reakcja świata | Działa w sprawdzonym fragmencie | Ręczne wejście z klawiatury w prawdziwej przeglądarce: ruch postaci, strzały i eksplozja. Bez deklaracji ukończenia misji. |
| 3. Pauza | Działa | Menu pauzy z przyciskami wznowienia, restartu, przerwania i opcji; [zrzut](portfolio-evidence/2026-10-21/blast-03-pause.jpg). |
| 4. Opcje w poziomym oknie 844 × 390 | Czytelne w tym widoku | Lista ustawień i WSTECZ mieszczą się w ekranie; [zrzut](portfolio-evidence/2026-10-21/blast-09-options-small.jpg). Nie sprawdzono odsłuchu ani każdej kombinacji ustawień. |
| 5. Układ dotykowy 844 × 390 | Układ działa; potrzebny telefon | Joystick oraz NÓŻ, SPEC, SKOK i OGIEŃ są widoczne; [zrzut](portfolio-evidence/2026-10-21/blast-10-touch-layout.jpg). Tryb dotykowy wymuszono w narzędziu testowym na Chrome, bez emulowania fizycznego Androida. |
| 6. Obrót do pionu 390 × 844 | Naprawiono | W wersji wyjściowej pod komunikatem nadal upływał czas misji. Po poprawce czas zatrzymał się na 2,9 s i pozostał na tej wartości przy kolejnym odczycie; pauza=true. [Komunikat po poprawce](portfolio-evidence/2026-10-21/blast-07-portrait-fixed.jpg). |
| 7. Powrót do poziomu | Działa | Gra pozostaje w pauzie, więc gracz ma czas wrócić do sterowania; [zrzut](portfolio-evidence/2026-10-21/blast-08-landscape-paused.jpg). |
| 8. Kampania, 15 misji | Przebieg stabilny; balans otwarty | Istniejący bot uruchomiony w prawdziwej przeglądarce przeszedł techniczny test wszystkich misji, ukończył 6/15. Pozostałe osiągnęły limit testu; nie oznacza to automatycznie błędu gry. |

Zrzuty wykonano podczas tego przeglądu. Ekrany z narzędziem kontrolnym pokazują
źródłową grę, nie makietę. Ekrany startu i pierwszej pauzy dotyczą bazowego buildu;
pozostałe wskazane zrzuty potwierdzają zachowanie poprawionej wersji źródłowej.

## Naprawione problemy

| Priorytet | Problem | Poprawka i weryfikacja |
|---|---|---|
| P1 | Build `--no-minify` kończył się sukcesem, ale składał uszkodzony JavaScript. Sekwencje takie jak `$'` w kodzie były interpretowane jako znaczniki zastępowania przez `String.replace`. | Zastępowanie przez funkcję zwrotną; kompilacja końcowych skryptów przez `node:vm` przed zapisaniem danego pliku. Test obejmuje gotowy HTML, specjalne sekwencje zastępowania i dosłowne zamknięcie tagu skryptu. |
| P1 | Ekran obrotu zasłaniał misję, a symulacja nadal działała. | Blokada kroków symulacji w pionie, wyczyszczenie trzymanych wejść, pauza rozpoczętej misji. Reset akumulatora czasu eliminuje nadrabianie kroków po powrocie. Testy logiki i ponowna kontrola w przeglądarce. |
| P2 | Eksport PNG pomijał osobne płótno HUD. | Złożenie gry i HUD przed zapisem; test odróżnia nagranie z HUD od świadomego `noHud`. |
| P2 | Brak automatycznej ochrony tych zachowań przy dalszej pracy. | 8 testów Node, 1 test HTTP w Pythonie i workflow GitHub Actions dla testów, tłumaczeń oraz buildu. |

Serwer deweloperski przyjmuje teraz także `--host`, `--port` i `--directory`;
zachowuje dawny argument pozycyjny portu. Eksport klatek ma własny endpoint ZIP,
sprawdzony lokalnym testem HTTP. Strona `tools/portfolio-review/` umożliwia
powtórzenie kontroli przez widoczne przyciski. Narzędzia nie trafiają do paczek gry.

## Wyniki testów

- `npm test`: **8/8**. Testy bazują na rzeczywistych modułach; hostowe API są
  zastąpione wyłącznie tam, gdzie potrzebne są deterministyczne zdarzenia i zegar.
- `python3 -m unittest discover -s test -p '*_test.py' -v`: **1/1**. Prawdziwy lokalny
  serwer, zapis plików przez POST, selektywny ZIP, identyczne bajty i brakujący prefiks.
- `node tools/build.mjs`: sukces, 41 plików źródłowych; web HTML około **662 KB**.
- `python3 tools/check_lang.py`: wszystkie **7 tabel tłumaczeń** poza angielskim
  przechodzą kontrolę, po 521 fraz. Nie jest to językowa korekta jakości tłumaczeń.
- Regresja bazowej kampanii: **15/15 bez wyjątków i NaN; 6/15 ukończonych przez bota**.
  Ukończone misje: 3, 4, 5, 7, 8, 14. Pozostałe osiągnęły limit 6000 kroków.
  [Pełny wynik JSON](portfolio-evidence/2026-10-21/blast-regression-baseline.json).

Regresja kampanii dotyczy bazowej wersji 1.33.1. Po poprawkach nie zmieniono fizyki,
celów ani balansu misji; wykonano testy ukierunkowane na zmienione zachowania.
Nie przeliczano czasu testu na FPS telefonów. W odczytanych logach występowały błędy
rozszerzenia przeglądarki; nie przedstawiono ich jako błędów gry.

## Zakres przed publicznym demem

| Kolejność | Zadanie | Warunek zamknięcia |
|---|---|---|
| 1 | Pierwsza misja na fizycznym Androidzie | Nowy zapis, bez instrukcji od autora: ruch + skok + ogień, uwolnienie obu jeńców, dotarcie do ekstrakcji, widoczny wynik. Osobno sprawdzenie śmierci i ponownej próby. |
| 2 | Cykl życia telefonu | Obrót w trakcie walki, zablokowanie telefonu, powrót z innej aplikacji; brak samoczynnego ataku, utraty kontroli i nieoczekiwanej utraty życia. Dźwięk wraca po świadomym wznowieniu. |
| 3 | Krótki test nowej osoby | Co najmniej jedna obserwowana sesja według `PLAYTEST.md`; konkretne miejsca utknięcia i reakcja na tutorial. Nie zastępuje tego bot. |
| 4 | Wybrać zakres publicznego demo | Pierwsza misja jako krótka próbka lub większy fragment po ręcznym sprawdzeniu. Uczciwa etykieta projektu w rozwoju i łatwy powrót do portfolio. |
| 5 | Osobny przegląd portalowy | Docelowy SDK, brak zawieszenia startu przy błędzie sieci, reklamy/rewarded i zasady dystrybucji sprawdzone dla wybranego portalu. |

W `src/platform.js` pozostają ścieżki startu SDK bez pełnego limitu oczekiwania;
zwykły web build `none` ich nie potrzebuje. Integracje portali nie zostały w tym
przeglądzie uruchomione na kontach deweloperskich. Dokument `RELEASE.md` zawiera
wcześniejsze założenia dotyczące dystrybucji: nie potraktowano go jako aktualnej
porady prawnej ani potwierdzenia akceptacji przez portal. Przygotowany podgląd
właściciela nie jest zgłoszeniem gry do portalu.

Menu rysowane w Canvas nie daje pełnej semantyki czytnikom ekranu. Ten przegląd
nie jest certyfikacją dostępności. Nie sprawdzono fizycznego multi-touch, Safari,
gamepada, co-op ani całej kampanii ręcznie.

## Sposób pokazania w PlazaWorks

Prowadzić do krótkiego uruchamialnego przykładu. Opis oprzeć na tym, co odwiedzający
może zobaczyć i sprawdzić: reakcje świata, sterowanie, własne narzędzia diagnostyczne,
praca nad małym ekranem. Nie eksponować surowej listy wszystkich funkcji jako
dowodu ich produkcyjnej jakości. AI pokazać w procesie pracy: decyzje autora,
przegląd wygenerowanego kodu, testowanie i doprowadzanie funkcji do działania.

Krótki klip pokazuje prawdziwy renderer i symulację, sterowane istniejącym botem
w trybie deweloperskim z nietykalnością. To materiał demonstracyjny bez dźwięku,
nie nagranie testu nowego gracza ani dowód balansu kampanii.

Przygotowano `Blast-Battalion-portfolio.mp4`: **9 s, 1920 × 1080, H.264, 30 fps,
270 klatek, bez ścieżki audio**. Trzy ujęcia z misji 3, 7 i 14: dżungla, pustynia,
śnieg. Nagranie Canvas z HUD zostało przycięte i przekształcone do MP4; bez
generowanych scen i interpolowanych klatek. [Kadry z gotowego pliku](portfolio-evidence/2026-10-21/clip-storyboard.jpg).
Plik filmowy przekazano oddzielnie; repozytorium nie przechowuje MP4.
