# Persoona: low-vision (heikkonäköinen, deuteranopia, näppäimistö + VoiceOver)

## 1. Persoona ja tehtävä
58-vuotias heikkonäköinen, puna–vihervärisokea (deuteranopia), selaa 200 % zoomilla (Playwright 640×400 @2x) ja VoiceOverilla pelkällä näppäimistöllä. Tehtävä: löydä tenniskenttä, avaa tiedot, lue osoite ja hinta, sulje ja tarkista mihin fokus palaa.

## 2. Onnistuiko
**Osittain.** Tieto löytyi ja on luettavissa, mutta fokuksenhallinta pettää avattaessa ja suljettaessa, eikä Escape sulje tietokorttia. Noin 40 näppäinpainallusta, arviolta 4–5 min (VoiceOver-käyttäjälle selvästi enemmän, koska avauksen jälkeen ruudunlukija ei kerro mitään).

Polku:
1. Sivu latautuu englanniksi (`lang="en"`), vaikka selaimen kieli on fi-FI. Tietosuojabanneri peittää kartan alaosan, myös "Laajenna paneeli"- ja "Loitonna"-painikkeet (01-first-load-200pct.png).
2. Ensimmäinen Tab menee Wiki-linkkiin, ja fokusrengas näkyy hyvin (02-first-tab.png).
3. 9. Tab osuu "Expand panel" -painikkeeseen, joka on bannerin alla piilossa. Fokus on näkymätön (03-focus-expand-hidden-under-banner.png).
4. Banneri on tabulointijärjestyksessä viimeisenä: "Only necessary" tulee vastaan 18 Tabin jälkeen (desktopissa 1280 px vasta 91 Tabin jälkeen, koska kaikki 60 listan kohdetta ovat ennen sitä). Enter sulkee bannerin, ja fokus putoaa `body`-elementtiin (04-banner-only-necessary-focused.png, 05-after-dismiss.png).
5. Tab ×9 hakukenttään. Fokuksen ilmaisin on vain ohut sininen reunus eikä 3 px:n rengas kuten muualla (06-search-focused.png).
6. Kirjoitan "tennis". Lista suodattuu 100 paikkaan, mutta `role=status` jää tyhjäksi, joten tulosmäärää ei kuulutettu (07-typed-tennis.png).
7. Tab → Clear, Tab → "Expand panel", Enter. Lista aukeaa (09-list-expanded.png), ja Tab vie listan kohteisiin selvällä fokusrenkaalla (10-list-item-focus.png). Tuloksissa on myös "Baana" ja muita kohteita, joista "Specific sports are not listed…", sekä pöytätennispaikkoja.
8. Enter kohteessa "Ala-Malmin liikuntapuisto". Kortti aukeaa, mutta **fokus menee `body`-elementtiin, ei otsikkoon**. Seuraava Tab hyppää suoraan "Directions"-painikkeeseen, jolloin Takaisin-, Ilmoita virhe- ja Pienennä-painikkeet ohittuvat (11-details-opened.png).
9. Osoite "Lallintie 12" ja hintatieto "Price and access aren’t listed in the source data yet." ovat luettavissa. Koko kortin sisältö on `aria-live`-alueessa, joten VoiceOver todennäköisesti lukee koko kortin pötkönä (12-details-tab4.png).
10. "Facilities (13)" avautuu Enterillä, ja Tenniskenttä 1–3 näkyvät. Alakohteet eivät ole fokusoitavia, eikä summaryssa ole näkyvää auki/kiinni-nuolta (14-facilities-expanded.png).
11. **Escape ei sulje korttia** (kokeiltu kahdesti fokuksen ollessa sekä kortissa että `body`-elementissä) (15-after-escape.png).
12. Shift+Tab "Back to facility list" -painikkeeseen ja Enter (16-back-button-focus.png). **Fokus putoaa taas `body`-elementtiin.** Avattu kohde on visuaalisesti korostettu, mutta seuraava Tab vie "Collapse panel" -painikkeeseen eikä takaisin Ala-Malmiin (17-after-back.png).

Lisätarkistukset:
- Kaikki paikat saa auki ilman karttaa: lista näyttää 60 kohdetta ja "Show more" -painikkeen. Kartan zoomaus ei muuta listaa, joten teksti "list of visible sports facilities" on harhaanjohtava. **"Show more" jättää fokuksen painikkeeseen, joka siirtyy listan loppuun ruudun ulkopuolelle (y≈5050)**. Uudet kohteet jäävät taakse, ja ne pitää hakea Shift+Tabilla (19-after-show-more.png).
- EN/FI: tavallisia `aria-pressed`-painikkeita. Nuolinäppäimet eivät tee mitään, mutta Tab + Enter toimii. FI vaihtaa `lang="fi"`-attribuutin ja kaikki tekstit, myös aria-nimet (20-finnish-200pct.png). Nimet "EN" ja "FI" luetaan kirjaimina, eikä "English/Suomi"-nimeä ole.
- 2D/Tilt: **piilotettu kokonaan 200 % zoomilla** (leveys 0). 1280 px:n leveydellä painikkeet ovat Tabilla saavutettavissa ja Space toimii, mutta nuolet eivät. Kääreen `aria-label="Map projection"` ei näy ruudunlukijalle, koska sillä ei ole roolia (22-deutan-tilt.png).
- Deuteranopia: klusterit ovat tummansinisiä numeroympyröitä ja yksittäiset merkit ruskean-oliivinvärisiä. Ne erottuvat koon ja numeron perusteella, eivät pelkän värin (21-deutan-desktop-banner.png, 23-deutan-tennis-markers.png). Trendit-paneelissa ykkönen on keltaisella pohjalla, mutta järjestysnumerot ja tekstit "RISING INTEREST" / "NEW ON THE LIST" kantavat saman tiedon (24-deutan-trending.png). Reittiviivoja en saanut näkyviin.
- Kontrasti: DOM-tekstistä ei löytynyt yhtään alle 4,5:1 olevaa paria (laskettu getComputedStyle-arvoista, 1280 px). Karttalaattojen tekstejä ei mitattu.
- Puhelin 390×844, teksti 150 %: ei vaakavieritystä, mutta banneri vie noin 40 % ruudusta (25-phone-large-text.png).
- Banneri: `dialog`, ei modaalinen eikä fokusloukku. Se peittää sisältöä, myös fokusoitavia painikkeita, eikä sitä voi ohittaa ilman kymmeniä Tabeja.

## 3. Pisteet 1–5
| Osa-alue | Pisteet | Perustelu |
|---|---|---|
| selkeys | 4 | 200 % zoomilla tekstit ovat isoja ja selkeitä, ja kortin rakenne (osoite, hinta, lajit) on looginen |
| luottamus | 3 | Fokus katoaa avatessa ja suljettaessa, ja hakutulosten määrä jää kuuluttamatta, joten ruudunlukijalla en tiedä mitä tapahtui |
| tehtävän onnistuminen | 3 | Tieto löytyi, mutta Escape ei toimi ja paluu listaan kadottaa paikan |
| nopeus | 2 | Banneri 18 Tabin (desktop 91) päässä, ja paluun jälkeen listassa joutuu tabuloimaan alusta |
| mobiilikäyttö | 3 | Iso teksti mahtuu ilman vaakavieritystä, mutta banneri peittää suuren osan ruudusta (testattu vain lyhyesti) |

## 4. Löydökset vakavuusjärjestyksessä
| # | vakavuus | mitä | missä | kuvatiedosto | korjausehdotus |
|---|---|---|---|---|---|
| 1 | vakava | Paikan avaaminen pudottaa fokuksen `body`-elementtiin. VoiceOver ei kuuluta mitään, ja seuraava Tab ohittaa Takaisin-painikkeen | Tietokortti, avaus listasta | 11-details-opened.png | Siirrä fokus kortin h2-otsikkoon (`tabindex="-1"`) avauksen jälkeen |
| 2 | vakava | Takaisin-painike pudottaa fokuksen `body`-elementtiin, ei avattuun listakohteeseen | Tietokortti → lista | 17-after-back.png | Palauta fokus listakohteeseen, jolla kortti avattiin |
| 3 | vakava | Escape ei sulje tietokorttia | Tietokortti | 15-after-escape.png | Escape = Takaisin (ja fokus palautuu kuten kohdassa 2) |
| 4 | vakava | "Show more" jättää fokuksen ruudun ulkopuolelle listan loppuun, ja uudet kohteet ohittuvat | Lista, Show more | 19-after-show-more.png | Siirrä fokus ensimmäiseen uuteen kohteeseen ja kuuluta "60 lisää ladattu" |
| 5 | vakava | Banneri peittää fokusoitavia säätimiä (Expand panel, Zoom out), ja fokus on niissä näkymätön | Tietosuojabanneri 200 % / mobiili | 03-focus-expand-hidden-under-banner.png | Banneri omaksi alueekseen sisällön alle (ei päälle) tai `scroll-padding-bottom` bannerin korkeudelle |
| 6 | kohtalainen | Banneri on tabulointijärjestyksen viimeinen (18 Tabia, desktop 91) | Tietosuojabanneri | 04-banner-only-necessary-focused.png | Siirrä banneri DOMissa alkuun tai lisää ohituslinkki. Palauta fokus järkevään kohtaan sulkemisen jälkeen (nyt `body`) |
| 7 | kohtalainen | Hakutulosten määrää ei kuuluteta, koska `role=status` jää tyhjäksi | Hakukenttä | 07-typed-tennis.png | Kirjoita "100 paikkaa" status-alueelle viiveellä |
| 8 | kohtalainen | Koko tietokortti on `aria-live`-alueessa, joten VoiceOver lukee kaiken pötkönä jokaisella muutoksella | Tietokortti | 12-details-tab4.png | Poista `aria-live` kortista ja kuuluta vain lyhyt "Avattu: <nimi>" |
| 9 | kohtalainen | 2D/Tilt puuttuu kokonaan 200 % zoomilla, nuolinäppäimet eivät toimi, ja ryhmän nimi ei näy ruudunlukijalle | Yläpalkki | 22-deutan-tilt.png | Näytä toggle myös kapeassa näkymässä (esim. Suodattimet-valikossa). Lisää `role="group"` nimelle |
| 10 | kohtalainen | "tennis"-haku palauttaa pöytätennistä ja paikkoja ilman lajitietoa (Baana) | Hakutulokset | 10-list-item-focus.png | Painota lajiosumaa ja suodata pois paikat, joilla ei ole lajia |
| 11 | pieni | Hakukentän fokusilmaisin on heikompi kuin muualla (ohut reunus) | Hakukenttä | 06-search-focused.png | Sama 3 px:n rengas kuin muissa säätimissä |
| 12 | pieni | Sivu avautuu englanniksi fi-FI-selaimella. EN/FI luetaan kirjaimina | Yläpalkki | 01-first-load-200pct.png | Oletuskieli `navigator.language`-arvon mukaan, `aria-label="English"/"Suomi"` ja `lang`-attribuutti painikkeille |
| 13 | pieni | "Facilities (13)" -summarysta puuttuu auki/kiinni-nuoli, alakohteet eivät ole fokusoitavia, ja EN-tilassa näkyy suomenkielisiä nimiä ("Tenniskenttä 1") | Tietokortti | 14-facilities-expanded.png | Lisää chevron. Alakohteet voi jättää tekstiksi, mutta lisää niille selkeä lista-rakenne |
| 14 | pieni | Listan kuvaus "list of visible sports facilities" on harhaanjohtava, koska lista ei riipu kartan näkymästä | Lista | 09-list-expanded.png | "Kaikki liikuntapaikat aakkosjärjestyksessä" |

## 5. Mikä toimi
- 3 px:n tummansininen fokusrengas näkyy lähes kaikissa säätimissä ja listakohteissa.
- Kaikki 1 368 paikkaa saa auki ilman karttaa listan ja "Show more" -painikkeen kautta. Listakohteiden nimet ovat kuvaavia (nimi + lajit + osoite).
- Landmarkit (main, navigation, complementary, region) ja otsikot h1/h2 ovat kunnossa, ja painikkeilla on nimet.
- FI-vaihto päivittää `lang`-attribuutin ja kaikki aria-nimet.
- Värisokealle tieto ei ole pelkän värin varassa: koko, numerot ja tekstimerkinnät kertovat saman. DOM-tekstin kontrasti on ≥ 4,5:1.
- Banneri ei vangitse fokusta, ja 200 % zoomilla tekstit ovat isoja ja luettavia.
