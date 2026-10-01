# Blast Battalion

Przeglądarkowa gra akcji typu run-and-gun na **CrazyGames** i **Poki**. W grze jest:
- zniszczalny teren;
- świat jako broń: beczki wybuchowe, beczki i rury z paliwem (cieknące kałuże, ogień biegnący po śladzie), mosty linowe do zestrzelenia;
- uwalnianie jeńców z losową zamianą bohatera;
- 12 bohaterów;
- 14 typów wrogów (m.in. snajper z laserem, miotacz ognia, oficer wzywający nalot) i ciężarówki z desantem; każdy atak jest zapowiedziany, a przy pierwszym spotkaniu wroga karta INTEL pokazuje jego twarz i sposób na niego;
- 3 bossów ze słabymi punktami;
- efekty z oświetleniem (poświata wybuchów, ognia i broni, fale uderzeniowe, grzyby, żar), pogoda w każdej strefie i ustawienie FX AUTO / FULL / LITE (AUTO samo przechodzi na LITE na słabym sprzęcie);
- 15 misji w 3 strefach, z różnymi celami: ewakuacja, zamach, sabotaż i ucieczka przed detonacją;
- tryb Arcade bez końca, jako rajd: po każdym etapie wybierasz 1 z 3 kart ulepszeń na resztę biegu (m.in. wybuchowe kule, łańcuch piorunów, rykoszety, deszcz beczek, latanie dla wszystkich);
- misja dnia (ten sam poziom dla wszystkich danego dnia) z szaloną regułą dnia (np. niska grawitacja, każdy poległy wybucha, dzień jednego bohatera);
- charakter: bohaterowie rzucają kwestiami, żołnierze krzyczą i panikują, Generał Grimm drwi przez radio;
- postacie reagują całym ciałem: lądowanie, poślizg przy zawracaniu, celowanie, odrzut, przeładowanie, drgnięcie po trafieniu, panika z rękami w górze, przewracanie falą uderzeniową, spadające hełmy, radość wrogów po śmierci bohatera, jeńcy machający zza krat; ataki bossów zapowiada sama maszyna (żarzący się wylot lufy, świecąca wyrzutnia, przysiad przed skokiem);
- pieniądze ($) za każdą misję (gwiazdki i nowe medale płacą więcej, porażka daje drobną nagrodę) i sklep UPGRADES ze stałymi ulepszeniami: FIREPOWER (+15% obrażeń), SUPPLY PACK (+1 specjal), RESERVES (+1 życie), BODY ARMOR (+1 HP);
- codzienna dostawa (panel po pierwszej ukończonej misji danego dnia i skrzynia na ekranie tytułowym): im więcej dni z rzędu, tym więcej pieniędzy, a panel pokazuje jutrzejszą kwotę;
- uczciwe śmierci: każda ma napis z przyczyną i (pierwsze dwa razy) podpowiedź, co zrobić następnym razem; gruz i zderzenie z bossem zabierają punkt życia zamiast zabijać od razu; pociski bossów mają czerwony znacznik miejsca upadku;
- po przegranej misji następna próba ma dodatkowe życie (najwyżej +2);
- pasek „NEXT HERO” po misji: ilu jeńców brakuje do następnego bohatera;
- garderoba: czapki (od bandany po koronę) i malowania dla każdego bohatera, kupowane za pieniądze z misji, z przymierzaniem przed zakupem;
- mini-bossowie: THE DOZER (buldożer mielący teren, szarża po zapowiedzi) i JUGGERNAUT (minigun z laserem, słaby punkt na plecach) w czterech misjach i w Arcade;
- sekrety: w każdej misji ukryty skarbiec pod popękaną ziemią (skocz na pęknięcia) ze złotą skrzynią i nagrodą;
- pojazdy: kroczący mech i czołg (działo z automatycznym celowaniem, taran, mielenie ścian, rozjeżdżanie żołnierzy);
- sceny filmowe: na starcie nowej strefy przelot z działkiem śmigłowca nad bazą wroga; pasy kinowe przy wejściu i śmierci bossa oraz przy wybuchu bazy;
- ekran tytułowy, pod którym gra prawdziwa misja (demo), a nowy gracz od razu zaczyna misję 1;
- HUD i menu w wojskowym stylu: bohater na nieśmiertelniku, trasa misji z jego twarzą, Grimm jak napisy w filmie, podpowiedzi sterowania jako klawisze nad bohaterem; menu z metalowych płyt z ikonami, wybór misji jako trasy stref, medale przypinane na ekranie wyników; samouczek z tabliczek-piktogramów z klawiszami gracza;
- lokalny co-op na 2 graczy;
- 3 poziomy trudności;
- 6 języków: angielski, hiszpański, portugalski (Brazylia), niemiecki, francuski i polski. Gra wybiera język przeglądarki, zmiana w OPTIONS → LANGUAGE.

Gra jest napisana w czystym JavaScripcie z Canvasem, bez zależności i bez plików graficznych czy dźwiękowych (wszystko generuje kod).

Dokumentacja:
- [docs/GDD.md](docs/GDD.md) — pełny projekt gry;
- [docs/PLAYTEST.md](docs/PLAYTEST.md) — jak przeprowadzić test z osobami, które grają pierwszy raz;
- [docs/RELEASE.md](docs/RELEASE.md) — lista kontrolna wydania na CrazyGames i Poki oraz to, jak gra spełnia wymagania portali;
- [docs/METRICS.md](docs/METRICS.md) — prognoza konwersji, czasu sesji i D1 bez danych z portalu (symulowani gracze + model lejka) i decyzje, które z niej wynikają.

## Uruchomienie

Najprościej: otwórz `index.html` w przeglądarce (działa z dysku).

Serwer deweloperski (bez cache'owania, potrzebny Python):

```bash
python tools/devserver.py 8321
```

Potem wejdź na http://localhost:8321.

Przydatne parametry adresu:

| Parametr | Działanie |
|---|---|
| `?level=5` | start od razu w misji 5 |
| `?unlockall=1` | odblokowuje wszystkie misje i bohaterów |
| `?platform=poki` / `?platform=crazygames` | ładuje SDK danego portalu |
| `?debug=1` | tryb debug (SDK Poki w trybie debug, `window.__bb` z dostępem do stanu gry) |

## Sterowanie

| Akcja | 1 gracz | Co-op P1 | Co-op P2 | Pad |
|---|---|---|---|---|
| Ruch | WASD / strzałki | WASD | strzałki | gałka / krzyżak |
| Skok (przytrzymanie = lot Skyhawka) | W / ↑ / Spacja / Z | W / Spacja | ↑ / Numpad 0 | A |
| Strzał | J / X | F | K / Numpad 1 | X / RT |
| Specjal (najpierw złota skrzynia) | K / C | G | L / Numpad 2 | B / LT |
| Nóż / kopnięcie (beczki, ciała, odbijanie granatów) | L / V | H | ; / Numpad 3 | Y |
| Ślizg pod kulami (w biegu) | S / ↓ | S | ↓ | gałka w dół |
| Złap żołnierza (przytrzymaj nóż), rzuć (nóż / strzał) | L / V | H | ; | Y |
| Mech: wsiądź (przy mechu) / wysiądź (przytrzymaj) | ↑ / ↓ | W / S | ↑ / ↓ | gałka |
| Pauza | Esc / P | | | Start |

Na ekranach dotykowych pojawia się wirtualny joystick oraz przyciski FIRE, JUMP, SPEC i KNIFE (dotknięcie = nóż / kopnięcie, przytrzymanie = złapanie żołnierza, kolejne dotknięcie = rzut). Strzał z bliska też działa jak nóż. Ślizg to joystick w dół w biegu. W co-op pierwszy podłączony pad steruje graczem 2.

Klawisze (układ 1 gracza) można zmienić w **OPTIONS → KEYBOARD CONTROLS**; tablice samouczka i klawisze nad bohaterem pokazują aktualne przypisania.

### Opcje i dostępność (OPTIONS w menu i w pauzie)

| Opcja | Wartości | Co robi |
|---|---|---|
| SOUND EFFECTS / MUSIC | ON / OFF | dźwięk i muzyka |
| SCREEN SHAKE | OFF / LOW / FULL | wstrząsy kamery |
| EFFECTS | AUTO / FULL / LITE | jakość efektów; AUTO samo przechodzi na LITE, gdy urządzenie nie wyrabia |
| BLOOD | ON / OFF | krew i rozrywanie ciał; w paczce CrazyGames domyślnie OFF (PEGI 12): trafienie daje obłoczek pyłu, a wybuch wyrzuca ciało w powietrze zamiast je rozrywać; w wersji web domyślnie ON. W paczce Poki tej opcji nie ma, a krwi nie ma nigdy (zasady treści Poki) |
| FLASHING | NORMAL / REDUCED | REDUCED: bez błysków całego ekranu i promieni, mniejsze i żółte zamiast białych błyski wybuchów, przy trafieniu tylko miękka czerwona ramka |
| AIM ASSIST | OFF / NORMAL / HIGH | siła wspomagania celowania do wrogów wyżej/niżej (na dotyku domyślnie HIGH) |
| AUTO FIRE | ON / OFF | bohater sam strzela, gdy wróg jest na linii strzału w zasięgu broni (na dotyku domyślnie ON) |
| VIBRATION | ON / OFF | tylko na telefonach: trafienie, śmierć, bliski wybuch, zniszczony boss |
| KEYBOARD CONTROLS | — | zmiana klawiszy: nowy klawisz staje się główny, poprzedni zapasowym; RESET TO DEFAULT (na telefonie tej pozycji nie ma) |

Menu: nowy gracz nie widzi ekranu tytułowego — gra startuje od razu w misji 1, z logo nad zrzutem ze śmigłowca. Powracający gracz widzi ekran tytułowy, pod którym gra prawdziwa misja (demo bez dźwięku i bez zapisu). Główny przycisk (▶ CONTINUE) uruchamia następną nieukończoną misję, jeden rząd niżej prowadzi do misji, Arcade, misji dnia, bohaterów, ulepszeń i co-op. W prawym górnym rogu są głośnik (cały dźwięk; efekty i muzyka osobno w opcjach), opcje i skrzynia dostawy. Każda z trzech gwiazdek misji ma własny warunek (ukończenie, wszyscy jeńcy, bez straty bohatera) i zostaje zdobyta na stałe, także jeśli warunki spełnia się w różnych podejściach; karta misji na ekranie wyboru i pauza pokazują, których jeszcze brakuje.

Zdarzenia trwają na tyle długo, żeby dało się je zrozumieć (zasady i liczby: [docs/GDD.md, 5.7](docs/GDD.md)):
- pociski bohatera lecą wolniej niż „prawdziwe”, ale dalej, i zostawiają świecącą smugę;
- trafiony wróg na moment błyska na biało i odlatuje łukiem; ciała, gruz i spadające klocki mają wspólną, łagodniejszą „filmową” grawitację (bohater i żołnierze — zwykłą, więc sterowanie się nie zmienia);
- konstrukcja bez podparcia przez chwilę trzeszczy, pęka i sypie pyłem, zanim runie (można z niej zeskoczyć), a most przed zerwaniem ugina się i trzeszczy;
- beczki w reakcji łańcuchowej wylatują w powietrze i wybuchają po kolei;
- po śmierci bohatera czas zwalnia, kamera zostaje na miejscu, a nad ciałem widać, co go zabiło (np. SHOT BY A SNIPER);
- postacie pokazują ciałem, co zaraz zrobią i co się stało (zasady i czasy: [docs/GDD.md, 5.14](docs/GDD.md)): żołnierz podskakuje na „!”, celuje z postawy i przeładowuje po serii, granatnik wyciąga zawleczkę i bierze zamach, moździerzysta wkłada pocisk do lufy i zatyka uszy, pies przysiada przed skokiem. Pozy bohatera nigdy nie opóźniają sterowania.

Wrogowie giną od wskoczenia im na głowę. Skok ze ślizgu leci dalej, a własny wybuch pod nogami podrzuca bohatera. Bohater ma 3 / 2 / 1 punkty życia na poziomach Recruit / Soldier / Veteran. Przed każdą serią wróg celuje, co widać jako czerwoną linię.

## Panel strojenia (F2)

W wersji lokalnej, webowej i w artefakcie klawisz **F2** (albo `~`) otwiera panel strojenia. W paczkach na Poki i CrazyGames panelu nie ma. Panel zawiera 57 suwaków w sześciu grupach:
- ruch: bieg, skok, grawitacja, coyote time, ślizg…;
- strzelanie: zasięg, prędkość pocisków, obszar trafienia, wspomaganie celowania, wybuchy, stop-klatka przy zabójstwie…;
- kamera: nowa / stara kamera, wyprzedzenie, opóźnienia, patrzenie w dół przy spadaniu, wstrząsy, odrzut…;
- wrogowie i trafienia: HP bohatera, nietykalność, czas reakcji i celowania wroga…;
- postacie: nowe / stare animacje, długość póz, podskok wroga na „!”, zamach granatnika, pocisk do lufy moździerza, przewracanie falą, radość wrogów, wiercenie się w bezruchu, zapowiedzi ataków bossów;
- gra: długość wybuchów i dymu, trzeszczenie terenu przed zawaleniem, grawitacja rzeczy (ciała, gruz, klocki), zwolnienie przy śmierci bohatera, prędkość gry.

Obsługa:
- zmiany działają od razu w trwającej misji i zapisują się w przeglądarce;
- dwuklik na suwaku przywraca wartość domyślną;
- **Kopiuj** kopiuje zmienione wartości jako JSON — wklej je w czacie albo wpisz jako `def` w `TUNE_DEFS` (`src/core.js`), żeby trafiły do gry na stałe;
- **Reset** przywraca wszystkie wartości domyślne.

## Testy z nowymi graczami (F3)

W tych samych wersjach (lokalnej, webowej i w artefakcie) gra zapisuje przebieg sesji na potrzeby playtestu: zgony z przyczyną i sprawcą, utknięcia, bezczynność, pierwsze użycie każdego klawisza i mechaniki, wyniki misji i kliknięcia w menu.

- **F3** otwiera panel „Raport z testu”. Na telefonie: pięć szybkich stuknięć w numer wersji na ekranie tytułowym.
- **Nowy tester** archiwizuje bieżący log, czyści postęp gry (jak przy pierwszym uruchomieniu) i odkłada Twój zapis na bok.
- **Przywróć mój zapis** kończy testy i przywraca Twój postęp.
- **Kopiuj** / **Kopiuj wszystkie** kopiuje raport (czytelny tekst + dane JSON) do wklejenia w czacie.
- Dane zostają w przeglądarce, nic nie jest wysyłane.

Jak przeprowadzić sesję, co obserwować i o co pytać: [docs/PLAYTEST.md](docs/PLAYTEST.md).

## Budowanie paczek dla portali

Wymaga Node.js (minifikacja przez `npx terser`, pobierany automatycznie).

```bash
node tools/build.mjs
```

Wynik w `dist/`:

| Plik | Do czego |
|---|---|
| `blast-battalion-crazygames.zip` | upload w CrazyGames Developer Portal (SDK v3 wpięte) |
| `blast-battalion-poki.zip` | upload w Poki for Developers (SDK v2 wpięte) |
| `blast-battalion-web.zip`, `web/index.html` | wersja bez SDK (itch.io, własna strona, testy) |
| `artifact/blast-battalion.html` | cała gra w jednym pliku HTML |

Materiały do stron gry na portalach są w `marketing/`:
- okładki 1920×1080, 800×1200 i 800×800 (tylko tytuł, zgodnie z zasadami CrazyGames);
- wideo podglądu 18 s w poziomie (1920×1080) i w pionie (1080×1620).

Jak je wygenerować ponownie, opisuje [docs/RELEASE.md](docs/RELEASE.md).

## Publikacja — krok po kroku

Pełna lista kontrolna (test regresji, przegląd ekranów, wymagania portali): [docs/RELEASE.md](docs/RELEASE.md). W skrócie:

1. `node tools/build.mjs`
2. **CrazyGames**:
   - wejdź na developer.crazygames.com → nowa gra → HTML5;
   - wgraj `blast-battalion-crazygames.zip`;
   - dodaj okładki i wideo z `marketing/`;
   - włącz przełącznik **Progress Save** (bez niego zapis w chmurze przez moduł Data nie działa);
   - przetestuj w podglądzie, gdzie reklamy są symulowane.

   Gra startuje w „Basic Launch”, a do „Full Launch” przechodzi po dobrych metrykach.
3. **Poki**:
   - wejdź na developers.poki.com → zgłoszenie gry;
   - wgraj `blast-battalion-poki.zip` i sprawdź go w Poki Inspector.

   Integrację SDK lokalnie sprawdzisz, dodając `?debug=1`.
4. Podbij `VERSION` w `src/core.js` przy każdej aktualizacji.

## Gdzie co zmieniać

| Chcę zmienić… | Plik |
|---|---|
| nazwę gry | `GAME_TITLE` w `src/core.js`, `<title>` w `index.html`, logo w `Logo` (`src/ui.js`, litery w `LOGO_GLYPHS`) |
| listę misji, cele (`goal`), trudność, pule wrogów | `LEVELS` w `src/levels.js` |
| misje Arcade | `arcadeDef()` w `src/levels.js` |
| poziomy trudności | `DIFFICULTY` w `src/levels.js` |
| budowle (prefabrykaty ASCII) | `PREFABS` w `src/levels.js` |
| bohaterów i progi odblokowania | `HEROES` w `src/heroes.js`, wygląd w `LOOKS` (`src/sprites.js`) |
| pozy postaci i ich czasy | pozy w `POSES` (`src/sprites.js`); która poza kiedy: `animFrame()` w `src/heroes.js` i `src/enemies.js`; czasy w grupie POSTACIE panelu F2 (`TUNE_DEFS` w `src/core.js`) |
| ceny i działanie ulepszeń, nagrody pieniężne, codzienną dostawę | `UPGRADES`, `DAILY_DROP` i `Meta` w `src/meta.js` |
| karty ulepszeń Arcade i reguły dnia (i co robią) | `PERKS`, `DAILY_RULES` w `src/mods.js` (efekty czytane przez `World.mods`) |
| kwestie bohaterów, okrzyki żołnierzy, radio Generała Grimma | `src/chatter.js` |
| przedmioty ze złotych skrzyń | `POCKET_ITEMS` i `usePocket()` w `src/heroes.js` |
| statystyki wrogów | `ENEMY_DEFS` w `src/enemies.js` |
| pułapki, syreny, składy paliwa | `Alarm`, `Mine`, `Spikes`, `Depot` w `src/entities.js` |
| paliwo (wycieki, kałuże, ogień) i mosty linowe | `src/hazards.js` (stałe w `FUEL`) |
| ciężarówki z desantem, nalot oficera, karta INTEL przy pierwszym spotkaniu wroga | `src/army.js` (`ENEMY_INTRO`) |
| HUD: nieśmiertelnik, trasa misji, wynik, Grimm, TIP, INTEL, klawisze nad bohaterem | `src/hud.js` |
| wygląd menu: płyty, przyciski, plakietki, medale, ikony | `src/uikit.js` |
| tłumaczenia | zwroty w `src/lang_*.js` (klucz to angielski napis z gry); zdania z liczbami i nazwami: reguły `L10N_RULES` w `src/lang.js` i ich wzory w `rules` każdego języka; po zmianie uruchom `python tools/check_lang.py` |
| nowy język | nowy plik `src/lang_xx.js` (jak `lang_es.js`), wpis w `LANGS` (`src/lang.js`) i w `index.html`; brakujące litery dopisz do czcionki (`ACCENTED` w `src/gfx.js`) |
| tabliczki samouczka (piktogramy z klawiszami) | `signParts()` w `src/entities.js` |
| zasady celów misji, ścianę detonacji, finał | `src/world.js` (`objectiveText`, `updateDoom`, `updateFinale`) |
| bossów | `src/bosses.js` |
| reklamy / SDK | `src/platform.js` |
| muzykę | `SONGS` w `src/audio.js` (nuty zapisane tekstem) |

## Testy

`tools/harness.js` to narzędzie testowe, które nie trafia do paczek. Wstrzykuje się je na stronie uruchomionej z `?debug=1` (wersja deweloperska `index.html` z serwera). Udostępnia:
- `TT.start(n)` — start misji;
- `TT.step(n)` — ręczne kroki symulacji;
- `TT.shot(nazwa)` — zrzut canvasu przez serwer deweloperski;
- `TT.logical(w, h)` i `await TT.screens(tag)` — zrzuty wszystkich menu i nakładek przy zadanym rozmiarze widoku (przegląd układu na nietypowych ekranach);
- `AUTO(kroki, { god: true })` — prosty bot, który przechodzi misję i loguje zdarzenia;
- `await REGRESS()` — test regresji: bot przechodzi wszystkie misje i zgłasza wyjątki, NaN, rozrost liczby obiektów i czas klatki. Przed wydaniem musi dać `PASS`;
- `await HUMANSIM()` i `await HUMANBOSS({ level })` — symulowani nowi gracze (nowicjusz, przeciętny, wprawny) grają kampanię albo jedną misję; wynik (czasy, porażki, przyczyny śmierci) przyjmuje `python tools/funnel.py`, który przelicza go na przewidywaną konwersję, czas sesji i D1. Opis w [docs/METRICS.md](docs/METRICS.md).

Obok są:
- `tools/posesheet.js` (`await POSESHEET.all()`) — arkusz wszystkich postaci we wszystkich pozach;
- `tools/animfilm.js` (`await FILM.scene('grunt')`, po `harness.js`) — taśma filmowa sceny: kolejne klatki wokół jednej postaci obok siebie (żołnierz, granatnik, moździerz, snajper, pies, panika, przewrócenie falą, radość wrogów, śmierci, jeńcy, spadochroniarz, bossowie);
- `tools/keyart.js` (`KEYART_ALL()`) — generuje okładki;
- `tools/trailer.js` z `tools/mp4mux.js` (`TRAILER.video(...)`) — nagrywa wideo podglądu. Zapisy są powtarzalne dzięki ustalonemu ziarnu losowości, a MP4 koduje przeglądarka (WebCodecs).

## Struktura

```
index.html        strona gry (wersja deweloperska, ładuje src/*.js)
src/              kod gry (kolejność ładowania w index.html)
tools/build.mjs   budowanie paczek + ZIP
tools/devserver.py serwer deweloperski
tools/harness.js  narzędzia testowe: bot, przegląd ekranów, test regresji REGRESS(), symulowani gracze HUMANSIM()
tools/funnel.py   model lejka: przewidywana konwersja, czas sesji i D1 z wyników HUMANSIM()
tools/check_lang.py sprawdza tłumaczenia: litery w czcionce, te same zwroty we wszystkich językach
tools/posesheet.js, tools/animfilm.js   podgląd póz i taśmy filmowe animacji postaci (nie trafiają do paczek)
tools/keyart.js, tools/trailer.js, tools/mp4mux.js   okładki i wideo podglądu (nie trafiają do paczek)
docs/GDD.md       dokument projektowy
docs/PLAYTEST.md  instrukcja sesji testowej z nowymi graczami
docs/METRICS.md   prognoza metryk portali i decyzje z niej
docs/RELEASE.md   lista kontrolna wydania i wymagania portali
marketing/        okładki i wideo podglądu dla portali
```
