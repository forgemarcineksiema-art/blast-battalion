# Playtest — sesja z graczami, którzy grają pierwszy raz

**Cel:** zobaczyć grę oczami kogoś, kto jej nie zna, i zamienić to na listę poprawek.

**Kto:** 2–3 osoby, które nigdy nie grały w Blast Battalion. Najlepiej różne: ktoś, kto często gra w gry przeglądarkowe lub mobilne, i ktoś, kto gra rzadko.

**Ile:** 15–20 minut gry na osobę plus 5 minut rozmowy. Każda osoba gra osobno, pozostałe nie patrzą.

---

## 1. Przygotowanie (5 minut przed pierwszą osobą)

1. **Wersja gry.** Są trzy możliwości:
   - artefakt (link z czatu) — jest prywatny, więc na cudzym urządzeniu zadziała dopiero po udostępnieniu w menu *Share*;
   - lokalnie: `python tools/devserver.py 8321`, potem http://localhost:8321;
   - plik `dist/web/index.html`, na przykład na własnym urządzeniu testera.

   Wersje dla Poki i CrazyGames nie mają zapisu testu.
2. **Czysty start.** Naciśnij **F3** (panel „Raport z testu”). Wpisz etykietę bez imienia i nazwiska, np. „Tester A”, i kliknij **Nowy tester** dwa razy. Strona przeładuje się z pustym postępem, jak u kogoś, kto gra pierwszy raz. Twój własny zapis zostaje odłożony na bok.
   - Na telefonie lub tablecie bez klawiatury panel otwiera się pięcioma szybkimi stuknięciami w numer wersji (lewy górny róg ekranu tytułowego). Po „Nowy tester” gra zaczyna od razu od misji 1, bez ekranu tytułowego (1.31). Na telefonie po raport wejdź na ekran tytułowy przez pauzę (wyjście z misji, potem wstecz).
3. **Strojenie.** Jeśli panel F3 pokazuje żółte ostrzeżenie o zmienionym strojeniu, a chcesz testować wartości domyślne, otwórz **F2** i kliknij **Reset**.
4. **Warunki.** Dźwięk włączony (słuchawki albo głośnik), duże okno lub pełny ekran. Urządzenie takie, na jakim tester zwykle gra: komputer albo telefon poziomo.
5. **Notatki.** Przygotuj kartkę albo notatnik z tabelą z punktu 6 i zegarek (liczysz czas od startu).

## 2. Co powiedzieć na początku

> „To gra akcji w przeglądarce. Graj tak, jak grałbyś sam w domu. Mów na głos, co myślisz: co próbujesz zrobić, co cię dziwi, co cię denerwuje. Sprawdzamy grę, a nie ciebie. Nie będę podpowiadać, bo chcę zobaczyć, gdzie gra sama nie tłumaczy.”

Nic więcej nie wyjaśniaj: ani sterowania, ani celu gry.

## 3. Zasady dla osoby, która obserwuje

- **Nie podpowiadaj.** Na pytanie „co mam zrobić?” odpowiedz „a jak myślisz?”.
- **Pomóż dopiero wtedy**, gdy ktoś utknął na ponad 2 minuty albo chce przestać. Zanotuj wtedy dokładnie, w czym pomogłeś. To najcenniejsze znalezisko z całej sesji.
- **Zapisuj czas i dokładne słowa gracza.** Cytat („nie wiem, czemu zginąłem”) mówi więcej niż ocena.
- **Nie broń gry i nie tłumacz błędów.** Jeśli coś nie działa, zanotuj i graj dalej.
- **Patrz na twarz i ręce**, nie tylko na ekran: śmiech, westchnienie, szukanie klawiszy, zerkanie na telefon.

## 4. Przebieg (około 20 minut)

| Czas | Co się dzieje | Na co patrzysz |
|---|---|---|
| 0–1 min | start: od razu misja 1, logo nad zrzutem ze śmigłowca | Czy rozumie, że już gra? Czy rusza sam, zanim zobaczy klawisze nad bohaterem? Czy czeka na coś? |
| pierwsze sekundy misji 1 | powitalne beczki | Czy strzela w beczki po podpowiedzi „J: SHOOT”? Czy łańcuch wybuchów robi wrażenie? Czy wie, jak wyjść z krateru? |
| 1–10 min | kampania od misji 1 (samouczek), potem dalej | pierwsza minuta ruchu i strzału, pierwsze starcie, pierwsza śmierć |
| 10–15 min | gra swobodna: kolejne misje, Arcade albo Heroes, co tester woli | Czy sam z siebie chce grać dalej? Co wybiera? |
| koniec | tester sam mówi „wystarczy” (zanotuj kiedy i dlaczego) albo mija 20 minut | nie przedłużaj na siłę |
| +5 min | rozmowa (punkt 5) | |
| na koniec | **F3 → Kopiuj** (po ostatniej osobie: **Kopiuj wszystkie**) | raport wklejasz do czatu razem z notatkami |

### Lista kontrolna do obserwacji

**Pierwsza minuta**
- Czy znalazł ruch, skok i strzał bez szukania? Ile to trwało?
- Czy czyta tablice samouczka? Czy zatrzymuje się przy nich, czy je mija?
- Czy rozumie, że pociski kopią w ziemi i niszczą teren?

**Walka i śmierć**
- Czy zauważa czerwoną linię celownika wroga? Czy reaguje (skok, ślizg, schowanie się)?
- Czy po trafieniu wie, że stracił punkt życia? Serca w panelu bohatera (lewy górny róg) to punkty życia; utracone serce robi się szare, ostatnie pulsuje. Hełm „×3” pod spodem to zapas bohaterów (życia).
- Czy po śmierci wie, **dlaczego** zginął? Zapytaj krótko: „co się stało?”.
- Czy któryś wróg jest wyraźnie frustrujący (psy, tarczownicy, moździerze, zamachowcy)?

**Rozumienie gry**
- Czy rozumie, że uwolnienie jeńca daje nowego bohatera i dodatkowe życie?
- Czy zauważa zmianę bohatera i nową broń?
- Czy rozumie cel misji (flaga, śmigłowiec; w późniejszych misjach zamach, składy paliwa, ucieczka)?
- Czy wie, dokąd iść? Czy wraca bez potrzeby?

**Mechaniki: czy odkrył je sam?**
- specjal (K / C) i jego licznik;
- nóż (L / V), kopnięcie beczki, odbicie granatu;
- ślizg (bieg + ↓), deptanie po głowach;
- złapanie żołnierza (przytrzymanie noża) i rzut;
- mech (↑ przy mechu, wyjście przez przytrzymanie ↓);
- złote skrzynie i przedmioty z nich;
- zielone beczki i rury z paliwem (w misji 2): czy rozumie, że kula robi wyciek, a ogień podpala kałużę? Czy wpada na pomysł, żeby podpalić ślad albo kopnąć beczkę?
- most linowy (w misji 2): czy zestrzeli słupek, gdy stoją na nim żołnierze? Czy po zawaleniu mostu wie, jak wyjść z przepaści (drabina po drugiej stronie)?

**Miejsca wskazane przez symulację graczy (1.19, [METRICS.md](METRICS.md))** — bot tego nie rozstrzygnie, człowiek tak:
- misja 3 (ucieczka przed detonacją): czy gracz rozumie, że ma biec, czy zatrzymuje się do strzelania?
- misja 4 (zamach): czy sam znajduje drogę na piętro kwatery do pułkownika? Bot jej nie znajduje;
- bossowie (misje 5 i 10): czy widzi czerwone znaczniki pocisków i z nich schodzi?
- po śmierci: czy czyta pasek z żółtą etykietą TIP (na dole ekranu) i czy następnym razem robi to, co radzi?
- ekran porażki: czy wybiera „RETRY +1 LIFE” (i czy w ogóle zauważa dodatkowe życie)?
- po pierwszej misji: czy rozumie panel SUPPLY DROP („jutro więcej”)? Zapytaj po grze: „wrócisz jutro? po co?”.

**Pojazdy, sekrety, mini-bossowie (1.22–1.24)**
- przelot z działkiem (misja 6): czy strzela z działka, czy od razu pomija przelot?
- czołg (misja 8): czy wsiada? Czy rozumie, że działo samo celuje po łuku?
- sekret: czy zauważa błysk z popękanej ziemi i próbuje na nią skoczyć?
- ściany (1.26): czy łapie ścianę celowo i strzela z niej? Czy odkrywa obrót na ścianie (kierunek od ściany) i skok od ściany? Czy coś go w skakaniu zaskakuje (zapytaj: „co zrobił bohater, czego się nie spodziewałeś?”)?
- garderoba: czy zauważa znacznik na HEROES i zagląda do WARDROBE? Czy coś kupuje i co wybiera? Czy przymierzanie (pierwsze kliknięcie) jest jasne?
- mini-boss (misja 4 JUGGERNAUT, misja 7 THE DOZER): czy sam odkrywa słaby punkt (plecy, kabina), czy strzela w pancerz? Czy uskakuje przed szarżą po czerwonym świetle? Czy chowa się albo przeskakuje, gdy widzi laser?

**HUD i samouczek (1.27)**
- tabliczki-piktogramy w misji 1: czy tester robi to, co pokazuje tabliczka, bez pytania? Która jest niejasna? Po misji zapytaj: „co mówiła tabliczka z klatką? a ta ze ścianą?”;
- nieśmiertelnik: czy wie, ile ma serc i specjali i jakim klawiszem rzuca specjal? Czy zauważa klatki jeńców i hełm z życiami?
- trasa misji u góry: czy zerka na nią, żeby sprawdzić, ile zostało? Czy rozumie czerwoną flagę (cel jeszcze niewykonany)?
- karta INTEL: czy ją czyta i robi, co radzi (np. rusza się, gdy laser snajpera zbieleje)?
- czy coś na ekranie zasłania akcję albo przeszkadza? Zapytaj po grze: „czy coś na ekranie ci przeszkadzało albo było niejasne?”.
- menu (1.28): czy od razu klika żółty przycisk, żeby grać dalej? Czy w wyborze misji rozumie trasy i złotą linię? Czy na ekranie wyników wie, za co dostał medale?

**Języki (1.29)** — gdy tester woli inny język niż angielski:
- gra sama wybiera język przeglądarki; sprawdź, czy wybrała dobrze (OPTIONS → LANGUAGE);
- czy jakiś napis jest niezrozumiały, dziwnie przetłumaczony albo ucięty? Zapisz dokładne brzmienie i ekran;
- czy tester rozumie zdania z liczbami (np. ile zabójstw, ile żyć) i napis z przyczyną śmierci?

**Arcade i misja dnia (1.20)** — jeśli tester sam tam zajrzy:
- czy czyta karty ulepszeń, czy klika pierwszą z brzegu? Którą wybiera i czy czuje jej działanie?
- czy po końcu biegu od razu zaczyna nowy („jeszcze raz”)?
- czy reguła dnia go bawi i czy rozumie ją z samego napisu na starcie?
- czy zauważa kwestie bohaterów i radio Grimma? Czy śmieszą, czy przeszkadzają?

**Emocje**
- Co wywołało śmiech, „wow” albo „ale jazda”?
- Gdzie pojawia się frustracja albo nuda (zerkanie w telefon, szybkie klikanie bez celu)?

## 5. Pytania po grze

1. Opowiedz własnymi słowami, o co chodzi w tej grze.
2. Co było najfajniejsze? Jaki moment zapamiętasz?
3. Co było najbardziej frustrujące albo niesprawiedliwe?
4. Czy coś było niejasne: sterowanie, cel misji, dlaczego zginąłeś?
5. Co oznaczała czerwona linia przed strzałem wroga?
6. Co się dzieje, kiedy uwalniasz jeńca?
7. Oceń od 1 do 5: trudność (1 = za łatwo, 3 = w sam raz, 5 = za trudno) i wygodę sterowania (1 = niewygodne, 5 = bardzo wygodne).
8. Zagrałbyś jeszcze? Na czym: komputer czy telefon? Poleciłbyś komuś?
9. Czego ci brakowało?

## 6. Arkusz notatek (jeden na osobę)

Tester: ________ Urządzenie: ________ Data: ________

| Czas | Co się stało | Reakcja lub cytat | Moja hipoteza |
|---|---|---|---|
| 0:40 | minął tablicę SLIDE i nie użył ślizgu | „jak się kucało?” | tablica za mała / za wcześnie |
| | | | |

## 7. Co gra zapisuje sama (panel F3)

- przebieg każdej misji: wynik, czas, najdalszy punkt, jeńcy, bohaterowie, co gracz zrobił na końcu (ponów, menu, dalej);
- każdy zgon: przyczyna, sprawca (typ wroga, beczka, mina, boss…), miejsce jako procent długości misji;
- trafienia, które nie zabiły, z podziałem na przyczyny;
- utknięcia: co najmniej 25 s bez postępu w prawo, z wysokością ściany przed bohaterem i liczbą wrogów obok;
- bezczynność: co najmniej 15 s bez naciśnięcia żadnego klawisza;
- próby ewakuacji przed wykonaniem celu misji;
- pierwsze użycie każdego klawisza i każdej mechaniki (czas gry i misja) oraz lista tych, których gracz nie użył;
- pauzy, kliknięcia w menu, sprzęt i rozmiar ekranu, zmienione strojenie;
- sekcja **SYGNAŁY DO SPRAWDZENIA** z automatycznymi podpowiedziami, o co dopytać.

Dane zostają w tej przeglądarce (localStorage), nic nie jest nigdzie wysyłane. Archiwum trzyma 5 ostatnich logów. Po ostatnim testerze kliknij **Przywróć mój zapis**: wróci Twój postęp sprzed testów.

## 8. Po sesji

Wklej do czatu:
- raporty (**Kopiuj wszystkie**);
- arkusze notatek;
- odpowiedzi na pytania.

Claude złoży z tego listę poprawek z priorytetami:
- **P1** — ktoś utknął, przestał grać albo ginął, nie wiedząc dlaczego;
- **P2** — coś było niejasne, ale gracz sobie poradził;
- **P3** — szlif i kosmetyka.

Najpierw idą poprawki P1, potem nowe funkcje.
