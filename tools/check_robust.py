"""Testy odporności 0.2.7: szkic po odświeżeniu, dwa okna, zablokowana baza, pasek dźwięku."""
import re
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
res = []


def ok(c, m):
    res.append(bool(c))
    print(("OK   " if c else "BŁĄD ") + m)


with sync_playwright() as p:
    # dźwięk wymaga gestu – jak w zwykłej karcie Chrome na tablecie
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, has_touch=True)
    # atrapa Web Audio jak w Chrome na tablecie: po starcie uśpiona, budzi się tylko po geście użytkownika
    ctx.add_init_script("""(() => { class FakeCtx { constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {} }
      resume() { if (navigator.userActivation && navigator.userActivation.isActive) this.state = 'running'; return Promise.resolve() }
      createOscillator() { return { frequency: { value: 0 }, type: '', connect: (g) => g, start() {}, stop() {} } }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: () => ({}) } } }
      window.AudioContext = FakeCtx; window.webkitAudioContext = FakeCtx })()""")
    page = ctx.new_page()
    page.clock.install(time=datetime(2026, 11, 27, 9, 0, 0))
    page.goto(URL + "#/odo")
    page.evaluate("indexedDB.deleteDatabase('asystent-kdr'); localStorage.clear()")
    page.reload()
    page.wait_for_timeout(500)
    dlg = lambda: page.get_by_role("dialog").last

    def digits(s):
        for ch in s:
            dlg().get_by_role("button", name=ch, exact=True).click()

    # --- 1. odświeżenie w trakcie wpisu nowej roty ---
    page.get_by_role("button", name=re.compile("Nowa rota")).click()
    dlg().get_by_placeholder("Ratownik 1").fill("Michał")
    dlg().get_by_placeholder("Ratownik 2").fill("Paweł")
    dlg().get_by_role("button", name=re.compile("Sygnalizatory")).click()
    digits("310300")
    page.clock.fast_forward("02:00")  # mija czas – godzina WEJŚCIA ma zostać pierwotna (9:00)
    page.reload()
    page.wait_for_timeout(800)
    d = dlg()
    txt = d.inner_text()
    ok("Przywrócono niezapisany wpis z 09:00" in txt, "po odświeżeniu okno nowej roty wraca z informacją")
    ok(d.get_by_placeholder("Ratownik 1").input_value() == "Michał", "imię ratownika przywrócone")
    ok("310" in txt and "300" in txt, "ciśnienia przywrócone")
    ok("09:00" in txt and "pierwotna" in txt, "godzina WEJŚCIA pierwotna (09:00)")
    d.get_by_role("button", name=re.compile("^WEJŚCIE")).click()
    page.get_by_role("dialog").wait_for(state="detached")
    ok(page.locator("article", has_text="Rota 1").get_by_text("WEJŚCIE 09:00").count() == 1, "zapisana rota ma godzinę WEJŚCIA 09:00")

    # --- 2. odświeżenie w trakcie kontroli ---
    card = page.locator("article", has_text="Rota 1")
    card.get_by_role("button", name="KONTROLA").click()
    digits("200")
    page.reload()
    page.wait_for_timeout(800)
    ok("Kontrola ciśnienia – Rota 1" in dlg().inner_text() and "200" in dlg().inner_text(), "okno kontroli wraca po odświeżeniu z wpisanym 200")
    digits("120")
    dlg().get_by_role("button", name="ZAPISZ").click()
    page.wait_for_timeout(300)
    ok("Decyzja KDR – Rota 1" in dlg().inner_text(), "Paweł 120/180 → decyzja KDR")
    # --- 3. odświeżenie przy decyzji KDR ---
    page.reload()
    page.wait_for_timeout(800)
    ok(page.get_by_role("dialog").count() == 1 and "Decyzja KDR – Rota 1" in dlg().inner_text(), "pytanie o decyzję KDR wraca po odświeżeniu")
    dlg().get_by_role("button", name="WYCOFANIE ROTY").click()
    page.wait_for_timeout(300)
    page.reload()
    page.wait_for_timeout(800)
    ok(page.get_by_role("dialog").count() == 0, "po decyzji nic się nie przywraca")

    # --- 4. pasek dźwięku: mały, a < 60 s przed kontrolą duży ---
    small = page.get_by_text("Dźwięk wyłączony przez przeglądarkę").count()
    ok(small == 1, "po odświeżeniu mały pasek dźwięku (nie czerwony)")
    page.clock.fast_forward("04:10")  # kontrola za < 60 s
    page.wait_for_timeout(1200)
    ok(page.get_by_text("DŹWIĘK ALARMÓW WYŁĄCZONY – zbliża się kontrola").count() == 1, "< 60 s do kontroli → duży czerwony pasek")
    page.mouse.click(640, 500)  # dowolne dotknięcie
    page.wait_for_timeout(1200)
    ok(page.get_by_text("DŹWIĘK ALARMÓW WYŁĄCZONY").count() == 0 and page.get_by_text("Dźwięk wyłączony").count() == 0, "dowolne dotknięcie włącza dźwięk – pasek znika")

    # --- 5. dwa okna aplikacji ---
    page2 = ctx.new_page()
    page2.goto(URL + "#/pulpit")
    page2.wait_for_timeout(1000)
    ok(page.get_by_text("otwarta także w innym oknie").count() == 1, "pierwsze okno ostrzega o drugim")
    ok(page2.get_by_text("otwarta także w innym oknie").count() == 1, "drugie okno ostrzega o pierwszym")
    page2.close()
    page.wait_for_timeout(500)
    ok(page.get_by_text("otwarta także w innym oknie").count() == 0, "po zamknięciu drugiego okna ostrzeżenie znika")

    # --- 6. zablokowana baza (inne okno trzyma transakcję) ---
    blocker = ctx.new_page()
    blocker.goto("about:blank")
    blocker.goto(URL + "#/pulpit")
    blocker.wait_for_timeout(500)
    blocker.evaluate("""() => { const end = Date.now() + 15000; const q = indexedDB.open('asystent-kdr');
        q.onsuccess = () => { const st = q.result.transaction('events', 'readwrite').objectStore('events');
          const keep = () => { st.get(0).onsuccess = () => { if (Date.now() < end) keep() } }; keep() } }""")
    page.reload()
    page.wait_for_timeout(7000)
    ok(page.get_by_text("BAZA DANYCH NIE ODPOWIADA").count() == 1, "zablokowana baza → czerwony komunikat z instrukcją")
    blocker.close()
    page.wait_for_timeout(9000)
    page.get_by_role("button", name="Sprawdź ponownie").dispatch_event("click")
    page.wait_for_timeout(1500)
    ok(page.get_by_text("BAZA DANYCH NIE ODPOWIADA").count() == 0, "po zamknięciu blokującego okna „Sprawdź ponownie” – komunikat znika")
    b.close()

print(f"\nWynik: {sum(res)}/{len(res)}")
