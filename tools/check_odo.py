"""Symulacja akcji ODO: 3 roty + RA, punkt pracy, alarmy kontroli, blokada, decyzje KDR, wyjście, offline, raport."""
import re
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

URL, OUT = sys.argv[1], sys.argv[2]
results = []
save_times = []


def ok(cond, msg):
    results.append((bool(cond), msg))
    print(("OK   " if cond else "BŁĄD ") + msg)


def wait_ok(fn, msg, timeout=5000):
    import time
    end = time.time() + timeout / 1000
    while time.time() < end:
        try:
            if fn():
                return ok(True, msg)
        except Exception:
            pass
        time.sleep(0.1)
    ok(False, msg)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("""window.__notifAsked = 0; if (window.Notification) { Notification.requestPermission = () => { window.__notifAsked++; return Promise.resolve('default'); }; }""")
    page.clock.install(time=datetime(2026, 11, 26, 12, 45, 0))
    page.goto(URL)
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true)")
    page.reload()
    page.wait_for_function("!!navigator.serviceWorker.controller")

    def dlg():
        return page.get_by_role("dialog").last

    def pressures(values):
        d = dlg()
        for v in values:
            for ch in str(v):
                d.get_by_role("button", name=ch, exact=True).click()

    def new_rota(names, vals, spolem=True):
        btn = page.get_by_role("button", name="Nowa rota – WEJŚCIE")
        if btn.count():
            btn.click()
        else:
            page.get_by_role("button", name="Rota", exact=True).click()
        d = dlg()
        d.get_by_placeholder("Ratownik 1").fill(names[0])
        d.get_by_placeholder("Ratownik 2").fill(names[1])
        if spolem:
            for w in ["Sygnalizatory", "Poziom powietrza", "Oświetlenie", "Łączność", "Ekwipunek", "Meldunek o wejściu"]:
                d.get_by_role("button", name=re.compile(w)).click()
        pressures(vals)
        import time as _t
        t0 = _t.time()
        d.get_by_role("button", name=re.compile("^WEJŚCIE")).click()
        page.get_by_role("dialog").wait_for(state="detached", timeout=5000)
        save_times.append(_t.time() - t0)

    page.get_by_role("button", name="ODO", exact=True).click()
    page.screenshot(path=f"{OUT}/odo-empty.png")

    # RA przed wejściem
    page.get_by_role("button", name="Wyznacz rotę asekuracyjną").click()
    dlg().get_by_placeholder("Ratownik 1").fill("Adam")
    dlg().get_by_placeholder("Ratownik 2").fill("Ola")
    dlg().get_by_role("button", name="WYZNACZ RA").click()

    # 3 roty (rota 3 z niepełnym SPOŁEM)
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Rota", exact=True).click()
    d = dlg()
    d.get_by_placeholder("Ratownik 1").fill("Michał")
    d.get_by_placeholder("Ratownik 2").fill("Paweł")
    for w in ["Sygnalizatory", "Poziom powietrza", "Oświetlenie", "Łączność", "Ekwipunek", "Meldunek o wejściu"]:
        d.get_by_role("button", name=re.compile(w)).click()
    pressures([310, 300])
    page.screenshot(path=f"{OUT}/odo-new-rota.png")
    d.get_by_role("button", name=re.compile("^WEJŚCIE")).click()
    new_rota(["Kuba", "Tomek"], [300, 300])
    new_rota(["Ewa", "Jan"], [290, 260], spolem=False)

    ok(page.evaluate("window.__notifAsked") == 0, "zapis roty nie pyta o zgodę na powiadomienia")
    # szybkie stukanie (bez czekania na ekran) – cyfry nie mogą zginąć
    page.get_by_role("button", name="Rota", exact=True).click()
    got = page.evaluate("""async () => { const d = [...document.querySelectorAll('[role=dialog]')].pop();
        const b = (t) => [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
        for (const ch of '305295') b(ch).click();
        await new Promise((r) => setTimeout(r, 100));
        return [...d.querySelectorAll('button')].map((x) => x.textContent).filter((t) => /Ratownik/.test(t)).map((t) => (t.match(/(\\d{3})\\s*bar$/) || [])[1]); }""")
    ok(got == ["305", "295"], f"szybkie stukanie: {got}")
    dlg().get_by_role("button", name="Zamknij").click()
    ok(max(save_times) < 1.0, f"zapis roty i zamknięcie okna < 1 s (max {max(save_times):.2f} s)")

    card1 = page.locator("article", has_text="Rota 1")
    ok(card1.get_by_text("185", exact=True).count() and card1.get_by_text("180", exact=True).count(),
       "prognoza bez punktu pracy 310→185, 300→180")
    page.screenshot(path=f"{OUT}/odo-board-day.png")

    # +3 min: punkt pracy roty 1 (300 → 250 → prognoza 110, 310 → 270 → 100)
    page.clock.fast_forward("03:00")
    card1.get_by_role("button", name="PRACA", exact=True).click()
    pressures([270, 250])
    dlg().get_by_role("button", name="ZAPISZ PRACĘ").click()
    wait_ok(lambda: card1.get_by_text("100", exact=True).count() and card1.get_by_text("110", exact=True).count(),
       "prognoza z punktu pracy 100 / 110 (jak w przykładzie WSZP)")

    # +2:05 → roty 2 i 3 po terminie kontroli (wejście 12:45 + 5 min)
    page.clock.fast_forward("02:05")
    alarm = page.get_by_role("alertdialog")
    wait_ok(lambda: alarm.count() == 1 and "Rota 2" in alarm.inner_text() and "Rota 3" in alarm.inner_text(),
       "alarm kontroli dla rot 2 i 3 po 5 min")
    page.screenshot(path=f"{OUT}/odo-alarm.png")
    # odłożenie roty 3 o 1 min, kontrola roty 2
    alarm.locator("div", has_text="Rota 3").last.get_by_role("button", name="Odłóż 1 min").click()
    alarm = page.get_by_role("alertdialog")
    alarm.get_by_role("button", name="WPISZ KONTROLĘ").first.click()
    ok(page.get_by_role("dialog").last.inner_text().startswith("Kontrola ciśnienia – Rota 2"), "z alarmu otwiera się kontrola roty 2")
    pressures([250, 255])
    dlg().get_by_role("button", name="ZAPISZ").click()
    ok(page.get_by_role("alertdialog").count() == 0, "po kontroli roty 2 i odłożeniu roty 3 brak alarmu")

    # blokada dotyku, +1:10 → alarm roty 3 nad blokadą
    page.get_by_role("button", name=re.compile("Zablokuj dotyk")).click()
    page.clock.fast_forward("01:10")
    ok(page.get_by_role("alertdialog").count() == 1, "alarm widoczny przy blokadzie dotyku")
    ok(page.get_by_role("alertdialog").get_by_text("Dźwięk wyłączony").count() == 0, "dźwięk odblokowany po wcześniejszych dotknięciach")
    page.screenshot(path=f"{OUT}/odo-alarm-locked.png")
    page.get_by_role("alertdialog").get_by_role("button", name="WPISZ KONTROLĘ").click()
    ok(page.get_by_role("dialog", name="Ekran zablokowany").count() == 0, "WPISZ KONTROLĘ zdejmuje blokadę")
    pressures([240, 200])
    dlg().get_by_role("button", name="ZAPISZ").click()

    # rota 1: kontrola blisko prognozy (Paweł 120/110) → decyzja „poinformowana”
    page.get_by_role("dialog").count() and None
    card1.get_by_role("button", name="KONTROLA").click()
    pressures([190, 120])
    dlg().get_by_role("button", name="ZAPISZ").click()
    wait_ok(lambda: "Decyzja KDR – Rota 1" in dlg().inner_text(), "Paweł 120/110 → pytanie o decyzję KDR")
    page.screenshot(path=f"{OUT}/odo-decision-near.png")
    dlg().get_by_role("button", name="Rota poinformowana – kontynuacja").click()

    # rota 1: Paweł 105/110 → praca poniżej prognozy, powód: wentylacja
    page.clock.fast_forward("02:00")
    card1.get_by_role("button", name="KONTROLA").click()
    pressures([160, 105])
    dlg().get_by_role("button", name="ZAPISZ").click()
    dlg().get_by_role("button", name="Kontynuacja poniżej WYCOFAJ…").click()
    page.screenshot(path=f"{OUT}/odo-decision-reason.png")
    dlg().get_by_role("button", name="Wentylacja / poprawa widoczności").click()
    page.screenshot(path=f"{OUT}/odo-board-after-decision.png")

    # wyjście roty 1
    card1.get_by_role("button", name="Wyjście").click()
    pressures([130, 85])
    dlg().get_by_role("button", name="ZAPISZ WYJŚCIE").click()
    wait_ok(lambda: page.get_by_text("Wyszły ze strefy").count() == 1 and page.get_by_role("dialog").count() == 0, "rota 1 w sekcji „Wyszły ze strefy”")

    # wejście RA
    page.locator("article", has_text="W GOTOWOŚCI").get_by_role("button", name="WEJŚCIE RA").click()
    for w in ["Sygnalizatory", "Poziom powietrza", "Oświetlenie", "Łączność", "Ekwipunek", "Meldunek o wejściu"]:
        dlg().get_by_role("button", name=re.compile(w)).click()
    pressures([300, 300])
    dlg().get_by_role("button", name="WEJŚCIE RA").click()
    wait_ok(lambda: page.get_by_text("NIEWYZNACZONA").count() == 1, "po wejściu RA przypomnienie o nowej RA")

    # OFFLINE + przeładowanie: dane zostają
    ctx.set_offline(True)
    page.reload()
    page.wait_for_timeout(800)
    ok(page.locator("article", has_text="Rota 2").count() == 1 and page.get_by_text("Wyszły ze strefy").count() == 1,
       "po przeładowaniu offline roty i historia zostały")
    ctx.set_offline(False)

    # start bez # (jak ponowne uruchomienie) → wraca do ODO
    page.goto(URL)
    page.wait_for_timeout(800)
    ok(page.evaluate("location.hash") == "#/odo" and page.get_by_text("Kontrola rot ODO").count() >= 1, "po ponownym uruchomieniu wraca do ODO")

    # dziennik
    page.get_by_role("button", name="Dziennik").click()
    page.get_by_text("Dziennik kontroli ODO").wait_for()
    page.wait_for_timeout(500)
    journal = page.locator("main").inner_text()
    for frag in ["KONTYNUACJA PONIŻEJ WYCOFAJ", "Wentylacja", "rota poinformowana", "odłożona o 1 min", "SPOŁEM niepełne", "– PRACA:", "WYJŚCIE", "WEJŚCIE ROTY ASEKURACYJNEJ"]:
        ok(frag in journal, f"dziennik zawiera: {frag}")
    page.screenshot(path=f"{OUT}/odo-journal.png", full_page=True)
    page.get_by_role("button", name="Tablica").click()

    # raport bieżący
    page.get_by_role("button", name="Raport").click()
    wait_ok(lambda: "Michał" in page.locator("main").inner_text() and "Kontrola 12:53" in page.locator("main").inner_text(), "raport z tabelą rot i kontrolami")
    page.screenshot(path=f"{OUT}/odo-report.png", full_page=True)
    page.get_by_role("button", name="Wróć").click()

    # tryb nocny – zrzut tablicy
    page.get_by_role("button", name="Przełącz na tryb nocny").click()
    page.screenshot(path=f"{OUT}/odo-board-night.png")

    # pion
    page.set_viewport_size({"width": 800, "height": 1280})
    page.screenshot(path=f"{OUT}/odo-board-portrait.png")
    small = page.evaluate("""() => [...document.querySelectorAll('button')]
        .map(b => { const r = b.getBoundingClientRect(); return [b.innerText.trim() || b.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)] })
        .filter(([, w, h]) => w > 0 && (w < 48 || h < 48))""")
    ok(not small, f"przyciski ≥ 48 px {small}")
    ok(not errors, f"brak błędów JS {errors}")
    b.close()

print(f"\nWynik: {sum(r[0] for r in results)}/{len(results)}")
