# Varianta A — sjednocená kontrola příkazů

## Co je v náhledu

- Plná responzivní stránka v identitě Anime Sky s aktuálním app headerem, notebookovým hero blokem a reprezentativními dárky.
- Samostatné **Nastavení** v hero a oddělené hero **Více** bez duplicitního Nastavení.
- Desktopové pořadí **přepínač zobrazení → Zobrazení**; jediná kategorizovaná nabídka obsahuje skutečné zdrojové volby řazení, seskupení a filtrů. Aktivní filtry mají počet a odstranitelné pill prvky.
- Mobilní jednořádková lišta a jeden stabilní ohraničený spodní panel Zobrazení s připnutou navigací Řazení / Seskupení / Filtry.
- Výběrová lišta s explicitním počtem, Vybrat vše, jedním spouštěčem Akce a Zrušit výběr. Desktop používá kategorizovanou nabídku s další úrovní; mobil přechází v jednom panelu přehled → volby a nabízí zarovnané Zpět.
- Všech šest schválených hromadných kategorií: priorita, kategorie, zobrazení obrázku, pozadí obrázku, kopie do seznamu a stav obdržení. Kopie vždy nejprve vyžaduje konkrétní cílový seznam.
- Režim pořadí zachovává přepínač Karty / Seznam / Kompaktní a zobrazuje výslovné upozornění k omezení statického dema.

## Testovatelné ovládání

1. V levém panelu (na úzkých displejích v horním pásu) přepínejte role **Správce / Návštěvník / Obdarovaný**. Obdarovanému se odstraní neveřejné filtry „Pouze dostupné“ a „Oblíbené“ a jejich případný lokální aktivní stav.
2. Přepínejte fixture režimy **Procházení / Výběr / Pořadí / Prázdné**. Prázdný stav zároveň ukazuje nedostupné možnosti seskupení.
3. Otevřete **Zobrazení**, měňte řazení, seskupení a checkboxové filtry. Na desktopu lze pill filtry jednotlivě odstranit; na mobilu se sekce mění ve stejném panelu.
4. Ve Výběru otevřete **Akce**, vstupte do libovolné kategorie a na mobilu použijte **Zpět**. Výběr se při procházení úrovní zachovává.
5. Zapněte **Chyba příště** a spusťte hromadnou volbu: zobrazí se bezpečná chyba a výběr zůstane zachovaný. **Čekání** ručně kontroluje disabled/pending prezentaci; běžná demo mutace také na 1,2 s přejde do pending stavu.
6. Přepínejte světlé/tmavé canonical tokeny. Nabídky a panely zavřete Escape, kliknutím mimo nebo křížkem; fokus se vrací na spouštěč.
7. Hero a toolbar Více jsou role-gated. Toolbar Více nabízí reset, náhled obdarovaného, unfollow, výběr, změnu pořadí a dávkové přidání podle zvolené role.

## Omezení

- Jde o poctivou lokální simulaci bez produkčních dat, routingu, persistence, skutečného drag-and-drop, ukládání pořadí nebo síťových mutací.
- Přepnutí view v režimu pořadí demonstruje pouze to, že režim zůstane aktivní; neověřuje opravy inicializace ani produkční persistenci.
- Prototyp používá obyčejné focusovatelné HTML a neprohlašuje paritu focus-trapu, roving focus nebo positioningu Bits UI.
- Masku sticky toolbaru pouze zasazuje do kontextu podle přijatého řešení #366; není zde předmětem nového návrhu.
- Akce Nastavení, Přidat dárek, sdílení a ostatní navigační workflow zobrazují pouze lokální zpětnou vazbu a neotevírají produkční obrazovky.
- Canonical stylesheet je očekáván na orchestrátorem dodané cestě `../../open-issue-review/assets/app.css`; mockup jej linkuje za `../../tokens.css` a nepoužívá CDN.


## Opravy po kontrole

- [Zpět na přehled open-issue review](../../open-issue-review/index.html)
- Správce i obdarovaný mají schopnost správy; přechod na návštěvníka ukončí privilegovaný režim.
- Výchozí seskupení lokálního dema je Priorita. Vstup do pořadí jej pouze pro tuto relaci vědomě vypne.
- Desktopové Zobrazení používá první úroveň Řazení / Seskupení / Filtry a vnořenou úroveň se Zpět; nejde o tvrzení, že je opraven produkční positioning engine #364.
- Fixture „Počet 120“ ověřuje titul a počet v jednom řádku vedle sebe bez kolize se zavíracím tlačítkem.
- Úspěšné mutace jsou označené „Demo“, mění jen lokální souhrn zvolené kategorie a nikdy se nepersistují. Nulový výběr i probíhající požadavek se odmítnou; chyba výběr zachová.
