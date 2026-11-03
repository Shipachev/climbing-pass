from playwright.sync_api import sync_playwright
import json, os
with sync_playwright() as p:
 browser=p.chromium.launch(**({"executable_path":os.environ["CHROMIUM_PATH"]} if os.environ.get("CHROMIUM_PATH") else {}))
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173');page.wait_for_selector('#pass-form')
 page.get_by_role('button',name='Добавить абонемент',exact=True).click()
 page.get_by_role('button',name='Отметить посещение',exact=True).click()
 page.get_by_role('button',name='Начать по программе',exact=True).click()
 page.locator('.program-card').first.click()
 page.get_by_role('button',name='Начать тренировку',exact=True).click()
 def swipe(step, direction):
  card=page.locator(f'.stage-card[data-step="{step}"]')
  card.scroll_into_view_if_needed(); box=card.bounding_box()
  x=box['x']+box['width']/2; y=box['y']+25
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+direction*110,y,steps=12);page.mouse.up()
 swipe('s1',1)
 swipe('s2',-1)
 page.locator('[data-note="s7"]').fill('Проверка автосохранения <b>без HTML</b>')
 url=page.url;page.reload();page.wait_for_selector('.stage-card[data-step="s1"]')
 assert 'stage-done' in page.locator('.stage-card[data-step="s1"]').get_attribute('class')
 assert page.locator('[data-note="s7"]').input_value()=='Проверка автосохранения <b>без HTML</b>'
 page.get_by_role('button',name='Тренировки',exact=True).click()
 page.locator('.program-card').first.click()
 page.get_by_role('button',name='Редактировать',exact=True).click()
 page.locator('[data-field="title"]').fill('Новая редакция программы')
 page.reload();page.wait_for_selector('[data-field="title"]');assert page.locator('[data-field="title"]').input_value()=='Новая редакция программы'
 page.get_by_role('button',name='Сохранить новую версию',exact=True).click()
 page.wait_for_function("document.querySelector('h1')?.innerText === 'Новая редакция программы'")
 page.goto(url);page.wait_for_selector('.stage-card[data-step="s1"]');assert page.locator('h2').first.inner_text()=='Сила и техника в нависании'
 page.on('dialog',lambda d:d.accept())
 page.get_by_role('button',name='Завершить тренировку',exact=True).click()
 page.get_by_role('button',name='Возобновить тренировку',exact=True).click()
 assert 'stage-done' in page.locator('.stage-card[data-step="s1"]').get_attribute('class')
 page.evaluate('navigator.serviceWorker.ready');page.wait_for_timeout(1000)
 context.set_offline(True);page.reload();page.wait_for_selector('[data-note="s7"]')
 page.locator('[data-note="s7"]').fill('Заметка без сети');page.reload();page.wait_for_selector('[data-note="s7"]');assert page.locator('[data-note="s7"]').input_value()=='Заметка без сети'
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.screenshot(path='/tmp/climbpass-workout.png',full_page=True)
 page.get_by_role('button',name='Главная',exact=True).click();page.wait_for_selector('.pass-card');page.screenshot(path='/tmp/climbpass-home.png',full_page=True)
 assert not errors,errors
 print(json.dumps({'mobile_e2e':'passed','offline':'passed','reload_notes':'passed','snapshot_versions':'passed','errors':errors},ensure_ascii=False))
 browser.close()
