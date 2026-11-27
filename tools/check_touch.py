import re, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1.5, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (Linux; Android 16; SM-X306B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    page.goto(URL + "#/odo"); page.wait_for_timeout(800)
    page.evaluate("indexedDB.deleteDatabase('asystent-kdr')"); page.reload(); page.wait_for_timeout(800)
    page.get_by_role("button", name=re.compile("Nowa rota")).tap()
    d = page.get_by_role("dialog").last
    d.get_by_placeholder("Ratownik 1").tap(); page.keyboard.type("Michał")
    d.get_by_placeholder("Ratownik 2").tap(); page.keyboard.type("Paweł")
    d.get_by_role("button", name=re.compile("Ratownik|Michał")).first.tap()
    for ch in "310300":
        d.get_by_role("button", name=ch, exact=True).tap()
    fields = [t for t in d.get_by_role("button").all_inner_texts() if "bar" in t and ("Michał" in t or "Paweł" in t)]
    print("pola:", [f.replace("\n", " ") for f in fields])
    btn = d.get_by_role("button", name=re.compile("^WEJŚCIE"))
    print("WEJŚCIE aktywny:", not btn.is_disabled())
    btn.tap(); page.wait_for_timeout(800)
    print("okno zamknięte:", page.get_by_role("dialog").count() == 0, "| karta roty:", page.locator("article", has_text="Rota 1").count())
    print("błędy:", errs)
    b.close()
