# Wydanie na CrazyGames i Poki — lista kontrolna

Ten plik opisuje, co zrobić przed wysłaniem gry na portale i po wysłaniu, oraz jak gra spełnia wymagania portali. Wymagania CrazyGames sprawdzone 27.09.2026, a Poki 29.09.2026, w dokumentacji portali (linki na końcu). Portale zmieniają zasady, więc przed wysłaniem warto rzucić okiem na aktualne strony.

## 0. Najpierw decyzja: Poki albo CrazyGames

**Poki wymaga wyłączności w sieci.** Gra wydana na Poki nie może być na innych portalach ani agregatorach. Steam, sklepy z aplikacjami i konsole są dozwolone. Nie da się więc wydać gry na obu portalach naraz. Dokumentacja Poki nie mówi, od kiedy wyłączność obowiązuje (od testów czy od wydania), ani jak Poki traktuje gry, które już są na innym portalu. Nie mówi też, czy obejmuje wersję web na itch.io albo na własnej stronie (`blast-battalion-web.zip`). Przed wrzuceniem gry gdziekolwiek zapytaj o to Poki.

Rekomendacja z 29.09.2026: **najpierw Poki, CrazyGames jako plan B.** Testy Poki (punkt 5.1) są darmowe i szybkie, niczego nie publikują i dają prawdziwe dane: nagrania graczy przychodzą w kilka minut. Odwrotna kolejność, czyli Basic Launch na CrazyGames, prawdopodobnie zamyka drogę do Poki.

| | Poki | CrazyGames |
|---|---|---|
| wyłączność | wymagana (tylko sieć) | niewymagana |
| przychód | 50/50 z ruchu od Poki, 100% z własnego ruchu | wg umowy CrazyGames |
| testy przed wydaniem | nagrania → Player Fit Test → Web Fit Test → recenzja | Basic Launch → Full Launch |
| krew | nigdzie (brak opcji) | domyślnie wyłączona, gracz może włączyć |
| miniatury | kwadrat bez tekstu + animowany kwadrat 1080×1080 | okładki 16:9, 2:3, 1:1 tylko z tytułem |

## 1. Przed zbudowaniem

1. Podbij `VERSION` w `src/core.js`.
2. **Test regresji** (około 1–2 minut):
   - uruchom `python tools/devserver.py 8321` i otwórz `http://localhost:8321/index.html?debug=1&unlockall=1`;
   - w konsoli przeglądarki wklej:
     ```js
     const s = document.createElement('script'); s.src = '/tools/harness.js'; document.head.appendChild(s);
     ```
     a potem:
     ```js
     await REGRESS()
     ```
   - wynik musi zaczynać się od `PASS`, czyli 0 wyjątków i 0 NaN. Tabela w konsoli pokazuje dla każdej misji: zakończenie, zabicia, średni czas aktualizacji i rysowania oraz szczytowe liczby pocisków i cząsteczek;
   - to, ile misji bot ukończył, jest tylko informacją: bot nie umie wszystkiego, np. utyka pod sufitami.
3. **Przegląd ekranów** (nachodzące na siebie elementy na nietypowych ekranach):
   ```js
   for (const [w, h] of [[494, 240], [379, 214], [360, 192], [341, 256], [648, 270]]) { TT.logical(w, h); await TT.screens('q' + w + 'x' + h); }
   TT.unforce()
   ```
   Zrzuty lądują w `%TEMP%\blast_shots`.
   Po zmianach w trudności, bossach albo ekonomii dodatkowo porównaj wersje symulowanymi graczami (ok. 6 min): `copy(JSON.stringify(await HUMANSIM({ players: 4 })))` (wynik trafia do schowka), wklej go do pliku `nowy.json` i uruchom `python tools/funnel.py docs/metrics/sim_1.19.json nowy.json --timeouts pass`. Nowa wersja nie powinna mieć nowej ściany (misji, na której utyka wielu graczy) ani krótszej średniej sesji. Opis w [METRICS.md](METRICS.md).
4. **Sesja z testerami** według [PLAYTEST.md](PLAYTEST.md): wszystkie punkty P1 naprawione.

## 2. Budowanie i sprawdzenie paczek

1. Uruchom `node tools/build.mjs`. Wynik trafia do `dist/`. Paczki ZIP mają około 210 KB, bez żadnych plików zewnętrznych.
2. Wersja web: otwórz `dist/web/index.html`. Gra startuje i konsola jest pusta.
3. Poki: w Poki for Developers wgraj `blast-battalion-poki.zip` i przepuść go przez **Poki Inspector**. Lokalnie tryb debug SDK włącza `?debug=1`. Na localhost i 127.0.0.1 SDK samo loguje w konsoli każde wywołanie (`POKI: PokiSDK.gameplayStart()`). Z pustym zapisem gra startuje w M1, a `gameplayStart` ma się pojawić dopiero po pierwszym klawiszu albo dotknięciu, nie po wylądowaniu bohatera.
4. CrazyGames: w Developer Portal wgraj `blast-battalion-crazygames.zip` i sprawdź w podglądzie QA, gdzie reklamy są symulowane:
   - reklama między misjami (NEXT / RETRY / RESTART);
   - reklama nagradzana (CONTINUE +3 LIVES);
   - czy dźwięk milknie w czasie reklamy.
5. Telefon (najlepiej prawdziwy Android i iPhone):
   - w pionie pokazuje się ekran „obróć urządzenie”;
   - w poziomie widać joystick i przyciski FIRE / JUMP / SPEC / KNIFE;
   - dźwięk wraca po zminimalizowaniu przeglądarki i dotknięciu ekranu.

## 3. Materiały dla portali (`marketing/`)

| Plik | Do czego |
|---|---|
| `cover_1920x1080.png` | CrazyGames: okładka pozioma 16:9 |
| `portrait_800x1200.png` | CrazyGames: okładka pionowa 2:3 |
| `square_800x800.png` | CrazyGames: okładka kwadratowa 1:1 |
| `preview_1920x1080.mp4` | CrazyGames: wideo podglądu poziome, 18 s, bez dźwięku |
| `preview_1080x1620.mp4` | CrazyGames: wideo podglądu pionowe 2:3, 18 s, bez dźwięku, bez HUD |
| `poki_thumbnail_1080.png` | Poki: miniatura statyczna, kwadrat 1080×1080, bez tekstu |
| `poki_animated_1080.mp4` | Poki: miniatura animowana, kwadrat 1080×1080, 60 kl./s, bez dźwięku i HUD |

Okładki CrazyGames zawierają tylko tytuł gry. CrazyGames nie pozwala na inne napisy, ramki ani ikony sklepów. Miniatury Poki nie mają żadnego tekstu, nawet tytułu. Według testów Poki gracze częściej klikają miniatury bez tekstu, a na małych kafelkach napis i tak jest nieczytelny. Pokazują jednego głównego bohatera w domyślnym wyglądzie, w ruchu, na całej powierzchni, bez ramek. Unikaj koloru tła strony Poki (#83FFE7).

Jeśli formularz portalu pyta o języki gry, zaznacz: English, Spanish, Portuguese (Brazil), German, French, Polish. Stare okładki z wersji 1.0 są w `marketing/previous_v1.0/`, a ze starym logo (1.18) w `marketing/previous_v1.18/`. Wideo `preview_*.mp4` pochodzą jeszcze z wersji 1.18 (stary HUD).

Jak wygenerować materiały ponownie (strona z `?debug=1&unlockall=1` na serwerze deweloperskim):
- okładki i miniatura Poki:
  - wstrzyknij `tools/harness.js` i `tools/keyart.js`;
  - uruchom `await KEYART_ALL()` (okładki CrazyGames i `poki_thumbnail_1080`);
  - skopiuj pliki z `%TEMP%\blast_shots` do `marketing/`. Wybuchy są losowe, więc każde uruchomienie daje trochę inny obraz;
- miniatura animowana Poki: jak wideo niżej, w kwadracie, w 60 kl./s i bez HUD (Poki chce 4–6 s, 2–3 ujęcia po 1–2 s, 50+ kl./s): `await TRAILER.video('poki_animated_1080', [135, 135], 8, POKI_CLIPS, { noHud: true, clean: true, fps: 60 })`. `POKI_CLIPS` jest w `tools/trailer.js`;
- wideo:
  - wstrzyknij `tools/harness.js`, `tools/trailer.js` i `tools/mp4mux.js`, potem uruchom:
    ```js
    await TRAILER.video('preview_1920x1080', [480, 270], 4, [{ level: 3, sec: 4.5 }, { level: 7, sec: 4.5 }, { level: 12, sec: 4.5 }, { level: 4, sec: 4.5, steps: 2000, bossHp: 14 }])
    await TRAILER.video('preview_1080x1620', [180, 270], 6, [...te same ujęcia...], { noHud: true })
    ```
  - bot przechodzi każdą misję dwa razy z tym samym ziarnem losowości. Za pierwszym razem wybiera najbardziej widowiskowe 4,5 s, za drugim nagrywa ten fragment. Kodowanie H.264 robi przeglądarka (WebCodecs), plik trafia do `%TEMP%\blast_shots`.

## 4. Wymagania CrazyGames i stan gry

| Wymaganie | Stan |
|---|---|
| Rozmiar początkowy ≤ 50 MB (≤ 20 MB, żeby trafić na stronę główną na telefonach) | ✅ około 210 KB (ZIP), 615 KB po rozpakowaniu |
| Działa w Chrome i Edge (Safari: gra może zostać wyłączona, jeśli nie działa) | ✅ Chrome/Edge; Safari do sprawdzenia na iPhonie |
| Fizyka taka sama przy 60, 144 i 165 Hz | ✅ stały krok symulacji 60 Hz, niezależny od odświeżania ekranu |
| Czytelność przy devicePixelRatio 1 w ramkach od 907×510 do 1920×1080 i na telefonie 800×450 | ✅ skalowanie całkowite, a gdy żadna całkowita skala nie pasuje, ułamkowa (np. 640×360 → widok 445×250) |
| Angielski | ✅ cała gra po angielsku, a obok niej hiszpański, portugalski (Brazylia), niemiecki, francuski i polski (język przeglądarki, zmiana w OPTIONS → LANGUAGE) |
| Zakaz własnego przycisku pełnego ekranu | ✅ brak |
| Zakaz linków i cross-promocji | ✅ brak |
| PEGI 12 | ✅ kreskówkowa przemoc; w paczkach portalowych domyślnie bez krwi (BLOOD: OFF — pył zamiast krwi, wybuch wyrzuca ciało zamiast je rozrywać, bez plam); gracz może włączyć krew w opcjach. Okładki i wideo są bez krwi |
| Full Launch: nowy gracz w rozgrywce najpóźniej po 1 kliknięciu | ✅ ▶ PLAY → od razu misja samouczka; powracający gracz: ▶ CONTINUE → następna misja |
| Reklamy tylko w naturalnych przerwach; częstotliwością rządzi portal | ✅ NEXT, REPLAY, RETRY, RESTART, NEXT STAGE; gra nie ma własnych liczników reklam |
| Dźwięk gry wyciszony w czasie reklamy | ✅ `Sound.setAdMuted` przy `adStarted`, przywracany po `adFinished` lub `adError` |
| Reklama nagradzana: opcjonalna, z ikoną wideo, obok równie duże przyciski bez reklamy | ✅ RETRY nad CONTINUE, ta sama wielkość, ikona klapsa filmowego |
| Brak nagrody przy `adError` | ✅ komunikat „NO VIDEO AVAILABLE RIGHT NOW”, bez nagrody |
| Gra działa z adblockiem | ✅ reklama, która nie przyjdzie, nie blokuje gry (bezpiecznik po 8 s) |
| Zapis postępu przez moduł Data SDK | ✅ gra używa `SDK.data`, jeśli jest dostępny, a w przeciwnym razie localStorage. **Przy zgłoszeniu włącz przełącznik „Progress Save”**, bez niego moduł Data jest wyłączony |
| Bezpieczne strefy w aplikacji CrazyGames (notch) | ✅ `env(safe-area-inset-*)` w `index.html` |
| Telefon: brak zaznaczania tekstu i przybliżania | ✅ `user-select: none`, `touch-action: none` |
| iOS: wznowienie AudioContext po geście | ✅ `Sound.unlock()` przy każdym dotknięciu, kliknięciu i klawiszu |
| Okładki 1920×1080, 800×1200, 800×800, tylko tytuł | ✅ `marketing/` |
| Wideo 15–20 s, 1080p poziomo 16:9 i pionowo 2:3, bez dźwięku, czarnych pasów, kursora i napisów reklamowych, bez przyspieszania | ✅ `marketing/preview_*.mp4` (18 s, 30 kl./s, w czasie rzeczywistym) |
| Full Launch: konto CrazyGames (nazwa i awatar gracza w grze, automatyczne logowanie) | ⏳ niezrobione. Na Basic Launch niewymagane; do zrobienia, jeśli gra przejdzie do Full Launch |

## 5. Wymagania Poki i stan gry

Sprawdzone 29.09.2026 w [wymaganiach Poki](https://developers.poki.com/guide/requirements-quality) i [zasadach treści](https://developers.poki.com/guide/content-player-safety).

| Wymaganie | Stan |
|---|---|
| **Wyłączność w sieci** | ⚠️ decyzja, patrz punkt 0 |
| Komputer, telefon i tablet; na telefonie cały ekran (pion albo poziom) | ✅ poziomo; w pionie ekran „obróć urządzenie” |
| Proporcje 16:9, skalowanie do 640×360, 836×470 i 1031×580 | ✅ (640×360 przy dpr 1 → widok 445×250 w skali 1,44) |
| Ładowanie poniżej 10 s (gracze odchodzą po 10 s) | ✅ około 210 KB |
| localStorage w try/catch (tryb incognito) | ✅ `Platform.storeGet/storeSet` |
| Zapis postępu | ✅ `Save` w localStorage |
| Brak zapytań zewnętrznych (czcionki i zasoby w paczce) | ✅ czcionka Russo One jest w paczce; z zewnątrz ładuje się tylko SDK portalu |
| Brak splash screenów i linków wychodzących (logo studia wolno pokazać na ekranie ładowania) | ✅ |
| Gra działa z adblockiem, bez komunikatu „wyłącz adblocka” | ✅ |
| `gameplayStart()` przy **pierwszym ruchu gracza**, nie przy ładowaniu; bez dwóch startów ani dwóch stopów z rzędu | ✅ od 1.33.1. Nowy gracz trafia prosto do M1, więc `Platform` wstrzymuje start do pierwszego klawisza, dotknięcia, kliknięcia albo przycisku pada. Wcześniej start szedł po wylądowaniu bohatera, bez żadnego ruchu gracza. Flaga `inGameplay` blokuje powtórki |
| `gameplayStop()` przy każdej przerwie: pauza, menu, koniec misji, przerywnik | ✅ |
| `commercialBreak()` w drodze z przerwy z powrotem do rozgrywki; bez własnych liczników reklam | ✅ NEXT, REPLAY, RETRY, RESTART, NEXT STAGE |
| Dźwięk wyciszony w czasie reklamy | ✅ `Sound.setAdMuted` |
| Przycisk nagrody nie jest zielony, ma ikonę 🎬, zwykły przycisk jest nad nim albo obok i jest co najmniej tak samo duży | ✅ RETRY nad CONTINUE |
| Jedna reklama = jedna nagroda, bez podwójnej nagrody; przy adblocku bez nagrody | ✅ drugie kliknięcie używa tej samej prośby o reklamę; bez reklamy „NO VIDEO AVAILABLE RIGHT NOW” |
| Tylko reklamy Poki: bez zakupów w grze, cudzych reklam i podwójnych walut (np. gemy + monety) | ✅ jedna waluta ($) zdobywana w grze; reklama z nagrodą jest opcjonalna |
| Brak narzędzi deweloperskich w paczce | ✅ panele F2 i F3 oraz `window.__bb` działają tylko w wersji web i w artefakcie |
| Pauza pod Esc lub spacją | ✅ Esc / P |
| Przerywniki do pominięcia | ✅ nie ma długich przerywników: wejście do misji trwa 1,3 s, odlot helikopterem około 3 s; lot z działkiem można pominąć, trzymając skok |
| Samouczek obrazkami, nie tekstem | ✅ piktogramy z klawiszami (1.27), nic do czytania w trakcie akcji (1.33) |
| Sterowanie dotykowe na telefonach i tabletach, podpowiedzi klawiszy na komputerze | ✅ tryb dotykowy przy `pointer: coarse` |
| Treść dla wszystkich, także dzieci: bez ran i widocznych płynów ustrojowych | ✅ od 1.33.1 w paczce Poki krwi nie ma w ogóle, a opcja BLOOD znika (`Settings.bloodOption`); przedmiot ROID RAGE (sterydy) nazywa się BERSERK |
| Miniatura statyczna: kwadrat co najmniej 628×628, bez tekstu | ✅ `marketing/poki_thumbnail_1080.png` |
| Miniatura animowana: kwadrat 1080×1080, 4–6 s, 50+ kl./s, MP4 bez dźwięku, bez kursora | ✅ `marketing/poki_animated_1080.mp4` |

Rzeczy, o które recenzent może zapytać, choć zasady ich wprost nie zabraniają: krzyk wroga przy długim upadku, płonący żołnierze biegający w panice, psy wśród wrogów. W kreskówkowej grafice pikselowej to raczej przejdzie; zmieniać dopiero, jeśli Poki poprosi.

### 5.1 Ścieżka testów Poki

1. **Nagrania z playtestu.** Po wgraniu paczki w Poki for Developers przychodzi 10 nagrań prawdziwych graczy, zwykle w kilka minut. Można je zamawiać wielokrotnie. Trzeba obejrzeć co najmniej 5, żeby odblokować kolejny krok. Nagrania zastępują sesję z testerami z [PLAYTEST.md](PLAYTEST.md). Patrz na te same miejsca: pierwsze 30 s w M1, czy gracz znajduje pułkownika w M4, walki z bossami, gracze na telefonach.
2. **Player Fit Test.** Gra trafia do 500 graczy Poki. Mierzony jest tylko czas gry. Żeby przejść, średni czas gry musi przekraczać 3 minuty, a co najmniej 25% rozgrywek musi trwać ponad 3 minuty. Test trwa około 5 godzin, można robić najwyżej 2 dziennie.
3. **Web Fit Test.** Przez około 7 dni gra jest w prawdziwych kategoriach portalu. Mierzone są: klikalność miniatury, czas na stronie i konwersja do gry, w porównaniu ze średnią kategorii.
4. **Recenzja** (1–2 tygodnie), potem wydanie. Cel przed recenzją: konwersja 65%+ i średnio 5+ minut gry. Przeciętna gra na Poki ma około 70% konwersji i 6+ minut.

Model z [METRICS.md](METRICS.md) przewiduje około 84% konwersji i około 11 minut sesji, ale nie widział jeszcze żadnego prawdziwego gracza. Największa niewiadoma to telefony: gra działa tylko poziomo i ma wirtualny joystick w precyzyjnej strzelance.

## 6. Po wysłaniu

- Poki: po każdym teście porównaj wynik z progami z punktu 5.1. Jeśli Player Fit Test nie przejdzie, obejrzyj nagrania z miejsc, gdzie gracze odchodzą (Poki podpowiada: wejście do gry, jasność sterowania i celu, czas ładowania), popraw i zamów kolejny test.
- Pierwsze dni na CrazyGames (Basic Launch), jeśli wybrano CrazyGames:
  - obserwuj średni czas gry i odsetek graczy, którzy wracają;
  - porównaj te liczby z raportami z playtestu (F3), zwłaszcza z miejscami, gdzie gracze utykali albo ginęli.
- Każda aktualizacja:
  - podbij `VERSION`;
  - po zmianie napisów: dopisz je do tłumaczeń (`src/lang_*.js`) i uruchom `python tools/check_lang.py`;
  - uruchom `REGRESS()`;
  - zbuduj paczki i wgraj je ponownie. Zapis graczy (`blastbattalion_save_v1`) zostaje.

## Źródła

- CrazyGames:
  - [wymagania ogólne](https://docs.crazygames.com/requirements/intro/)
  - [techniczne](https://docs.crazygames.com/requirements/technical/)
  - [rozgrywka](https://docs.crazygames.com/requirements/gameplay/)
  - [reklamy](https://docs.crazygames.com/requirements/ads/)
  - [konto i zapisy](https://docs.crazygames.com/requirements/account-integration/)
  - [moduł Data](https://docs.crazygames.com/sdk/data/)
  - [okładki i wideo](https://docs.crazygames.com/requirements/game-covers/)
- Poki:
  - [wymagania i wytyczne](https://developers.poki.com/guide/requirements-quality)
  - [praca z Poki (wyłączność, przychód)](https://developers.poki.com/guide/working-with-poki)
  - [jak działa testowanie](https://developers.poki.com/guide/how-testing-works)
  - [Player Fit Test](https://developers.poki.com/guide/player-fit-test)
  - [treść i bezpieczeństwo graczy](https://developers.poki.com/guide/content-player-safety)
  - [miniatura statyczna](https://developers.poki.com/guide/thumbnail)
  - [strona gry i miniatura animowana](https://developers.poki.com/guide/your-game-page)
