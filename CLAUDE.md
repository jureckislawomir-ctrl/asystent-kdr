# Asystent KDR — reguły projektu

## Rola
Działasz jako Starszy Architekt Oprogramowania oraz Specjalista ds. Systemów Wspomagania Decyzji w Ratownictwie (PSP/OSP).
Budujemy aplikację PWA wspierającą Kierującego Działaniem Ratowniczym (KDR) podczas działań ratowniczo-gaśniczych.
Użytkownik jest dowódcą JRG PSP: w sprawach procedur, nomenklatury i taktyki rozstrzyga on. Ty odpowiadasz za technikę.

## 1. Wymagania techniczne i operacyjne
- **Urządzenie:** służbowy tablet z Androidem (Chrome). Obsługa w stresie i w rękawicach: cele dotykowe min. 48×48 px (w praktyce 56–64 px), duża czytelna typografia, brak zbędnych animacji, wyłączone przypadkowe przewijanie „pull-to-refresh” i podwójne stuknięcie z powiększeniem.
- **Offline-first (100%):** Service Worker (precache całej aplikacji) + lokalna baza w przeglądarce (IndexedDB przez Dexie.js; localStorage tylko na drobne ustawienia). Odświeżenie, zamknięcie przeglądarki lub restart tabletu nie mogą kasować danych z akcji.
  - Przy starcie wywołuj `navigator.storage.persist()` i pokazuj, czy pamięć jest trwała (inaczej Android może ją wyczyścić przy braku miejsca).
  - Aktualizacja aplikacji **nigdy** nie przeładowuje się sama. Pokazujemy komunikat „Dostępna nowa wersja” i KDR decyduje, kiedy zaktualizować (nie w trakcie akcji).
- **Tryb Dzień / Noc:** wysoki kontrast na pełne słońce oraz ciemny tryb taktyczny, nieoślepiający w kabinie w nocy. Stan alarmu/ostrzeżenia nigdy nie jest sygnalizowany samym kolorem: zawsze też tekstem, ikoną lub ramką.
- **Ekran zawsze włączony:** Wake Lock API z przełącznikiem w nagłówku, odnawiany po powrocie do aplikacji.
- **Blokada dotyku:** przycisk „Zablokuj” w nagłówku (każdy moduł). Ekran widoczny i aktualny, dotyk i „Wstecz” zablokowane, odblokowanie przytrzymaniem 1 s. Alarmy (od Kroku 2) muszą być widoczne, słyszalne i możliwe do potwierdzenia także przy włączonej blokadzie.
- **Nagłówek:** zegar + Sieć, Ekran, Zablokuj, Dzień/Noc. Wskaźniki „Zapisywanie” (offline), „Pamięć!” i „Bateria X%” pojawiają się tylko przy problemie (bateria: ≤ 30% bez ładowania wskaźnik, ≤ 15% czerwony pasek „PODŁĄCZ ŁADOWARKĘ”, od 0.2.9); pełna diagnostyka małym drukiem obok zegara na pulpicie.
- **Prostota i jeden ekran (decyzja użytkownika 27.11, 0.2.9):** informacje na kafelkach/kartach ograniczone do minimum; tablica ODO (3 roty + RA) i każde okno mieszczą się na ekranie tabletu bez przewijania (poziom: 4 kolumny; pion: 2). Rozmiar bazowy czcionki skaluje się z ekranem (`html { font-size: clamp(14px, …, 17px) }`, wszystko w rem) – dolna granica trzyma cele dotykowe ≥ 48 px. Szczegóły (ciśnienia każdego ratownika, wzory) – w raporcie, nie na tablicy. Test: tools/check_fit.py (1280×800/720/680, 800×1280/1180).
- **Polska nomenklatura:** KDR, poziomy kierowania (interwencyjny, taktyczny, strategiczny), odcinki bojowe, zastępy (GBA, GCBA, SCD, SLRt itd.), roty ODO, ciśnienie w barach, wydajność w l/min, węże W-52/W-75/W-110.
- **Charakter narzędzia:** aplikacja jest pomocnicza i nie zastępuje procedur ani decyzji KDR. Dane krytyczne dla bezpieczeństwa muszą być zweryfikowane przez użytkownika ze źródłem.
- **RODO:** meldunki i dane poszkodowanych zapisane na tablecie to dane osobowe. Minimalizujemy je, dajemy możliwość usunięcia danych akcji, a przed użyciem bojowym trzeba to uzgodnić z komendą.

## 2. Żelazna zasada pracy (metoda małych kroków)
Pracujemy iteracyjnie. **Nie wolno generować kodu dla kolejnego etapu, dopóki bieżący nie zostanie przetestowany przez użytkownika i zatwierdzony hasłem „ZATWIERDZAM KROK X”.**
Poprawki w zatwierdzonych krokach są dozwolone, jeśli wymaga ich bieżący krok, ale trzeba je wyraźnie wskazać.

## 3. Plan (kolejność: najpierw to, co chroni ratowników, bazy danych na końcu)
- **KROK 1: Szkielet PWA.** Manifest + Service Worker (offline), layout z nawigacją (dolna w pionie, boczna w poziomie), przełącznik Dzień/Noc, wskaźnik Online/Offline, status „gotowa offline”, trwałość pamięci, Wake Lock, Pulpit KDR.
  *Test:* zainstalowana na tablecie, w trybie samolotowym uruchamia się z ikony po zamknięciu Chrome i restarcie tabletu; motyw pamiętany.
- **KROK 2: Kontrola rot ODO – zarządzanie powietrzem.** Metodyka: „Zbiór dobrych praktyk w zakresie zarządzania powietrzem strażaków” (WSZP, KW PSP Poznań 2023, na bazie M. Baranowski „Zarządzanie powietrzem w działaniach straży pożarnej”) – zgodna z tablicą używaną w JRG użytkownika (zarzadzaniepowietrzem.pl).
  - **Zasada nadrzędna:** o wycofaniu decyduje **ciśnienie**, nie czas. Minutnik służy do przypominania o kontroli ciśnienia, stoper tylko mierzy czas od wejścia (nie wyznacza wycofania).
  - **Ustalenia użytkownika:** rezerwa obliczeniowa **60 bar**; domyślny interwał kontroli **5 min**; domyślnie **3 roty + rota asekuracyjna (RA)**, z możliwością dodania kolejnych. Wszystkie wartości w ustawieniach.
  - **Wzory (zweryfikowane z wykresem prognozowania WSZP, wszystkie komórki):**
    - stwierdzony punkt pracy: `Pwyc = R + (Pwej − Ppp)` (np. 300/250 → 110);
    - brak punktu pracy: `Pwyc = (Pwej − R) / 2 + R` (np. 300 → 180); wykres zaokrągla w dół do 10 bar (±5).
    - Bez PRACY prognoza liczona dla każdego ratownika z jego WEJŚCIA; WYCOFAJ roty = najwyższa (imię ratownika).
    - **PRACA – jedno pole, najniższe ciśnienie w rocie (decyzja użytkownika 27.11, 0.2.10):** nie wiadomo, kto je ma, więc WYCOFAJ roty = **R + (najwyższe WEJŚCIE − najniższe PRACA)** – górna granica zużycia, strona bezpieczna (np. 310/300, PRACA 250 → 120; przy 300/300 → 110 jak wykres). WYCOFAJ dotyczy roty – bez imienia. Starsze wpisy PRACY po jednym na ratownika liczone jak dawniej.
  - **Rota:** kryptonim + 2 ratowników (imię/pseudonim); wejście = wspólna godzina (automatyczna, edytowalna) + ciśnienie każdego; lista **SPOŁEM** do odhaczenia przed wejściem (Sygnalizatory, Poziom powietrza, Oświetlenie, Łączność, Ekwipunek, Meldunek o wejściu).
  - **Wpis ciśnień (0.2.9):** klawiatura 4×4 z przyciskami −10/+10; przy WEJŚCIU (rota, RA) pola wstępnie **300 bar** (ustawienie „Ciśnienie bazowe przy WEJŚCIU”, przycisk „300” na klawiaturze) – pierwsza cyfra zastępuje wartość bazową; przy pustym polu ±10 liczy od poprzedniego odczytu (kontrola: od najniższego w rocie; PRACA: od WEJŚCIA).
  - **Karta roty (0.2.9):** nazwa + ratownicy, „Kontrola za”, NAJNIŻSZE vs WYCOFAJ (imię ratownika), WEJŚCIE i czas w strefie, przyciski KONTROLA / PRACA / Wyjście / Wycofanie. Szacunek czasu do WYCOFAJ usunięty z karty (uproszczenie).
  - **Wycofanie (ręczne, 0.2.10):** okno z polem „Wprowadź NAJNIŻSZE ciśnienie w rocie” – zapisywane jako kontrola + decyzja KDR o wycofaniu; pole **nieobowiązkowe** (wycofanie nie może czekać na wpis).
  - Etykieta pola przy kontroli, PRACY i Wycofaniu: **„Wprowadź NAJNIŻSZE ciśnienie w rocie”** (decyzja użytkownika). WEJŚCIE i wyjście – nadal osobno dla każdego ratownika.
  - **Punkt pracy:** meldunek roty → godzina + najniższe ciśnienie → przeliczenie prognozy (przed meldunkiem prognoza „brak punktu pracy”).
  - **Kontrole (decyzja użytkownika 27.11, 0.2.8):** **jedno pole – najniższe ciśnienie w rocie** (zasada „dwóch wchodzi, dwóch wychodzi”); porównywane z **WYCOFAJ roty = najwyższa z prognoz ratowników** (z imieniem ratownika). WEJŚCIE, PRACA i wyjście nadal osobno dla każdego ratownika. Nieograniczona liczba kontroli; godzina zapisuje się sama; minutnik do następnej kontroli z alarmem (dźwięk z narastającą głośnością jak na tablicy, wibracja, alarm wizualny – nie tylko kolor), alarm przebija blokadę dotyku i wymaga potwierdzenia; wyróżnienie ratownika zbliżającego się do prognozy.
  - **Decyzja KDR o pracy poniżej prognozy** (np. po wentylacji) zapisywana z godziną. Komunikat: nie dopuścić do gwizdka.
  - **Wyjście:** ciśnienia + godzina; rota zostaje w historii akcji. Przypomnienie o odpoczynku i nawodnieniu.
  - **RA:** osobne pole przypominające o wyznaczeniu (§ 38 rozporządzenia o BHS); po wejściu RA prowadzona jak rota.
  - **Nazewnictwo (decyzja użytkownika):** w całym module ODO: WEJŚCIE, PRACA (punkt pracy), WYCOFAJ (prognozowane ciśnienie wycofania). Przycisk ręcznego wycofania: „Wycofanie”.
  - Dźwięk alarmu: Web Audio odblokowywane gestem (pointerup/touchend/click – nie pointerdown); gra głośnością multimediów Androida; w ustawieniach „Test dźwięku i wibracji”.
  - **Ograniczenie PWA potwierdzone testem (26.11):** po „Zamknij wszystko” na tablecie JS nie działa → brak alarmu do ponownego otwarcia; po otwarciu dźwięk zablokowany do pierwszego dotknięcia (pasek „DŹWIĘK ALARMÓW WYŁĄCZONY”). Pełne rozwiązanie: Capacitor (natywne alarmy) – decyzja użytkownika 27.11: **nie teraz**, później.
  - **Zgoda na powiadomienia tylko świadomie** (przycisk na tablicy ODO / w ustawieniach) – nigdy w trakcie zapisu roty: okno zgody Androida blokowało ekran ~30 s (zgłoszenie 27.11).
  - **Diagnostyka na tablecie (0.2.6):** każdy błąd na czerwonym pasku z treścią; przyciski zapisu pokazują „Zapisywanie…”, ostrzeżenie po 3 s i komunikat błędu; test bazy w diagnostyce pulpitu („baza: X ms”).
  - **Zawieszona baza (27.11, rozwiązane restartem):** na tablecie „brak odpowiedzi bazy > 5 s” – drugie, zamrożone okno aplikacji trzymało transakcję IndexedDB. Od 0.2.7: ostrzeżenie o drugim oknie (BroadcastChannel), czerwony komunikat „BAZA DANYCH NIE ODPOWIADA” z instrukcją, test bazy przy starcie i po powrocie do aplikacji.
  - **Szkic wpisu (0.2.7):** otwarte okno (nowa rota, RA, kontrola, PRACA, wyjście, decyzja KDR) wraca po odświeżeniu z wpisanymi danymi i **pierwotną godziną**; szkic znika po zapisie/anulowaniu, wygasa po 15 min.
  - **Dźwięk (0.2.7):** próba włączenia przy starcie i po powrocie do aplikacji (zainstalowana PWA może grać bez gestu); gdy zablokowany – mały pasek (znika po dowolnym dotknięciu), duży czerwony gdy do kontroli < 60 s.
  - Ostatnia zakładka zapamiętywana – po odświeżeniu/ponownym uruchomieniu powrót do ODO.
  - Opcjonalnie: szacunek czasu do prognozy z tempa spadku ciśnienia między kontrolami – wyraźnie oznaczony jako szacunek.
  - Czasy liczone ze **znaczników czasu**, dane w IndexedDB (Dexie) – odświeżenie/restart nie kasuje akcji.
  - Ograniczenie: przeglądarka w tle / w innej aplikacji może opóźnić alarm. Jeśli test wykaże problem → **Capacitor** (natywne alarmy Androida).
  - **Ustalenia (domyślne, zmienialne):** retencja zakończonych akcji **90 dni** (RODO), pytanie o decyzję KDR gdy ciśnienie ≤ **10 bar** nad prognozą, raport ODO jako tekst (Udostępnij) + PDF (Drukuj → Zapisz jako PDF). Dziennik akcji append-only (korekta = nowy wpis).
  - Dane tylko na jednym tablecie (offline, bez serwera) – eksport po akcji jako nawyk.
  *Test:* 3 roty + RA jednocześnie, poprawne prognozy (porównanie z wykresem WSZP), odświeżenie offline bez utraty danych, alarm kontroli na czas – także przy zgaszonym ekranie, przy blokadzie dotyku i po przełączeniu do innej aplikacji.
- **KROK 2B: Przekazanie kontroli ODO kodem QR (offline).** (Użytkownik ponowił prośbę 27.11 – realizacja po zatwierdzeniu Kroku 2.) Tablety w samochodach GBA, GCBA, SH 25 D. „Przekaż kontrolę” → QR z kartą ODO (kompresja, w razie potrzeby kilka kodów) → drugi tablet skanuje aparatem i przejmuje roty z historią; tablet przekazujący oznacza akcję jako przekazaną (bez podwójnego prowadzenia). Synchronizacja na żywo przez internet – tylko jeśli okaże się niezbędna.
  *Test:* przekazanie akcji z 3 rotami między dwoma tabletami w trybie samolotowym, zgodność danych.
- **KROK 3: Zaopatrzenie wodne.** Straty ciśnienia na W-52/W-75/W-110 liczone **wzorami**, różnica wysokości (±1 bar na 10 m), przetłaczanie/przepompowywanie, wydajność prądownic. Tabele z Kieszonkowego poradnika KDR (CNBOP-PIB) służą jako wzorzec testów; nie kopiujemy ich do aplikacji.
  *Test:* zgodność wyników z tabelami poradnika.
- **KROK 4: Tablica dowodzenia.** Zastępy przypisane do odcinków bojowych, chronologiczny dziennik zdarzeń z automatycznym czasem, generator meldunku dla SKKP/MSK, eksport raportu po akcji (tekst/PDF). Do rozważenia: moduł TRIAGE/liczenia poszkodowanych na bazie istniejącej aplikacji użytkownika.
  *Test:* symulacja akcji z 6 zastępami, gotowy meldunek, historia zachowana w pamięci tabletu.
- **KROK 5: Mapa offline z hydrantami.**
  - Mapa bazowa z **jednego pliku PMTiles** (wycinek rejonu chronionego) w MapLibre GL, opcjonalnie ortofotomapa z Geoportalu. **Nie pobieramy masowo kafelków z tile.openstreetmap.org** (zakazane przez regulamin OSM).
  - Hydranty i punkty czerpania z OSM (Overpass → GeoJSON), z obowiązkowym podpisem „© OpenStreetMap contributors” (licencja ODbL). Przed budową sprawdzić kompletność danych OSM w rejonie; w razie luk dodać import danych z wodociągów/gminy lub ręczne dodawanie punktów.
  - Pozycja GPS, najbliższe hydranty, pomiar odległości (rozwinięcie linii wężowej).
  *Test:* w trybie samolotowym widać pozycję GPS i najbliższe hydranty.
- **KROK 6: HAZMAT / ADR offline.** Wyszukiwarka numerów UN oraz numerów rozpoznawczych zagrożenia (Kemlera). Strefy i poziomy ochrony według **polskich zasad ratownictwa chemicznego i ekologicznego w KSRG** oraz kart ERICards, a nie przeniesione 1:1 z amerykańskiego ERG (ERG tylko jako pomocnicze źródło danych). Każda karta ma źródło i datę; dane krytyczne użytkownik weryfikuje ręcznie.
  *Test:* wyszukanie UN 1202, 1965, 1017 w czasie poniżej 2 s bez sieci.
- **KROK 7: Procedury.** Kafelek i zakładka dodane w Kroku 1 na prośbę użytkownika. Zakres (np. procedury i listy kontrolne dla KDR) do ustalenia z użytkownikiem przed rozpoczęciem kroku.

## 4. Stos technologiczny
React + Vite + Tailwind CSS v4 + vite-plugin-pwa (Workbox). IndexedDB przez Dexie.js od Kroku 2. Ikony lucide-react (wbudowane w paczkę, działają offline).
Bez zewnętrznych czcionek, CDN ani zapytań sieciowych w czasie działania. Routing przez `#/hash` (działa na każdym hostingu statycznym i z przyciskiem „Wstecz” Androida).
Hosting: **GitHub Pages** – repozytorium `jureckislawomir-ctrl/asystent-kdr` (publiczne), adres **https://jureckislawomir-ctrl.github.io/asystent-kdr/**.
Publikacja: push do `main` → workflow `.github/workflows/deploy.yml` (test logiki WSZP → build z `BASE_PATH=/asystent-kdr/` → Pages). Bez limitu wdrożeń.
Ścieżki w kodzie zawsze względem `import.meta.env.BASE_URL` / `%BASE_URL%` (aplikacja działa w podkatalogu).
Netlify (asystent-kdr.netlify.app) – porzucony 26.11.2026 z powodu limitu kredytów (15 kredytów/wdrożenie); nie wdrażać tam.
Tablet pobiera aplikację raz przez Wi-Fi, później działa bez sieci. Capacitor (APK) – później, decyzja użytkownika; tablety pozwalają instalować APK.

## 5. Status
- KROK 1: **zatwierdzony** 26.11.2026 (wersja 0.1.6, Galaxy Tab Active5 Pro, Android 16).
- KROK 2: oddany do testów (wersja 0.2.10, GitHub Pages), czeka na „ZATWIERDZAM KROK 2”. Testy automatyczne: tools/test_odo_logic.mjs (116/116, w tym 105 komórek wykresu WSZP), tools/check_odo.py (37/37), tools/check_robust.py (18/18), tools/check_fit.py (0 problemów), tools/check_battery.py (5/5), tools/check_touch.py (skrypty .py poza repozytorium, w /home/claude/tools).
