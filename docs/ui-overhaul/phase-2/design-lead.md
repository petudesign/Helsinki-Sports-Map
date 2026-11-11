# design-lead — Helsinki Sports Map

## 1. Persoona ja tehtävä
Design lead tuotefirmassa (Linear / Vercel / Wolt -taso), rekrytoi product designeria ja tuli portfoliosta, aikaa 2 min. Tehtävä: valita laji (tennis) ja avata paikka, ensin desktop 1600×1000 ja sitten puhelin 390×844. Lopuksi päätös, kutsuisinko suunnittelijan haastatteluun.

## 2. Onnistuiko
**Haastattelisinko: maybe (kallistuu "ei" Wolt/Linear-tasolle).** Perusrakenne ja typografia ovat siistejä, mutta värijärjestelmä, karttatyyli ja tilasiirtymät eivät ole hallinnassa. Lisäksi useassa kohdassa on keskeneräisiä tai templaattimaisia yksityiskohtia (filtteripaneeli, uppercase-mikrolabelit, "Work in progress"), joten kokonaisuus ei kerro senioritason käsityöstä.

Käyttäjätehtävä onnistui: kyllä. 10 askelta (5 desktop + 5 mobiili), aikaa noin 2 min.

1. Ensilataus: sininen klusterimeri, ja privacy-banneri peittää kartan oikean alakulman (`design-lead/01-first-load.png`)
2. "Only necessary" → hover Tennis-chipissä, hover-tila on hyvin heikko harmaa (`02-hover-tennis.png`)
3. Klikkaus Tennis, kuva ~100 ms jälkeen: lista vaihtuu heti, mutta kartta ei rajaa tuloksiin (`03-tennis-100ms.png`, `04-tennis-settled.png`)
4. Hover listarivillä (hyvä kortti-hover) → klikkaus "Helsingin Mailapelikeskus": 120 ms kohdalla kartta on täysin tyhjä beige ruutu (`05-list-hover.png`, `06-open-place-120ms.png`)
5. Paikka auki: zoomi 100 m, kartta haalea ja kontekstiton, paneelin alaosa tyhjä (`07-place-open.png`)
6. "Facilities (6)" auki: sama osoite toistuu kuusi kertaa (`08-facilities-open.png`)
7. Filters-popover: sinisiä tekstilinkkejä ilman chip-tyyliä, näyttää keskeneräiseltä (`09-filters.png`)
8. Mobiili ensilataus banneri + jälkeen (`10-m-first-load.png`, `11-m-after-banner.png`)
9. "All categories" → chip-ruudukko → Tennis; dropdown sanoo yhä "All categories" (`12-m-categories.png`, `13-m-tennis.png`)
10. Listan sheet auki → paikka auki; sheet peittää kartan kokonaan (`14-m-list.png`, `15-m-place.png`)

## 3. Pisteet 1–5
| osa-alue | pisteet | perustelu |
|---|---|---|
| selkeys | 3 | Rakenne (lista + kartta + chipit) on heti ymmärrettävä, mutta kolme kilpailevaa aksenttiväriä hämärtää hierarkiaa. |
| luottamus | 2 | "Work in progress" otsikossa, tyhjä kartta siirtymässä, raakaversion näköinen filtteripaneeli ja toisteinen data heikentävät uskottavuutta. |
| tehtävän onnistuminen | 4 | Tennis → paikka onnistui nopeasti molemmilla laitteilla. |
| nopeus | 4 | Vähän askelia ja nopea vaste, mutta kartan siirtymä paikkaan tulee kovana leikkauksena. |
| mobiilikäyttö | 3 | Sheet ja chip-ruudukko toimivat, mutta "All" + "All categories" ovat päällekkäiset ja detail peittää kartan. |

## 4. Löydökset vakavuusjärjestyksessä
| # | vakavuus | mitä | missä | kuvatiedosto | korjausehdotus |
|---|---|---|---|---|---|
| 1 | vakava | Väridisipliini puuttuu: aktiivinen chip ja Directions ovat kirkkaan sinisiä, 2D/EN-togglet tummanvihreitä, "Allow analytics" petroolia, yksittäiset pinnit tiilenpunaisia ja klusterit tummansinisiä. Sävyt eivät ole yhtä järjestelmää. | koko UI | 01, 04, 07 | Valitse yksi brändiaksentti ja yksi neutraali. Pinnit ja klusterit samaan perheeseen, valittu tila erottuu koolla tai renkaalla. |
| 2 | vakava | Paikan avaus on kova leikkaus: kartta näkyy hetken tyhjänä beigenä ruutuna ja hyppää 100 m zoomiin ilman flyTo-animaatiota. | desktop, paikan avaus | 06, 07 | Lyhyt flyTo nykyisestä näkymästä, zoom 15–16 jotta ympäristö näkyy, eikä tyhjää tile-ruutua. |
| 3 | vakava | Filters-popover näyttää rakennusvaiheelta: pieniä sinisiä tekstilinkkejä, "All" on ainoa täytetty pilleri, uppercase-labelit ja tiivis, epätasainen rytmi. | Filters-popover | 09 | Käytä samaa segmented control- tai chip-komponenttia kuin muualla, 8 px rytmi ja selkeä valittu tila. |
| 4 | kohtalainen | Kartta ei rajaa näkymää lajivalinnan jälkeen. Klusterit ja pinnit leikkautuvat reunoista, ja Reset-nappi kelluu irrallaan zoomikontrollin alla pinnin päällä. | kartta, Tennis-valinnan jälkeen | 03, 04 | fitBounds tuloksiin padding mukana. Reset samaan kontrolliryhmään zoomin kanssa, sama säde ja varjo. |
| 5 | kohtalainen | Valitulla paikalla ei ole valittua tilaa kartalla: punainen piste on samanlainen kuin muut. Tausta on haalea valkoinen huntu, joten kartta näyttää disabloidulta. | kartta, detail | 07 | Isompi brändivärinen pinni tai rengas valitulle. Pienennä huntua tai käytä tummempaa basemap-tyyliä. |
| 6 | kohtalainen | Templaattimaisia AI-merkkejä: uppercase-trackatut mikrolabelit (SPORTS, PRIVACY SETTINGS, 81 PLACES, OPEN OFFICIAL DETAILS, footer) ja pillereitä kaikkialla (Wiki, 2D/Tilt, EN/FI, lajit). | header, detail, footer | 01, 07 | Sentence case ja tavallinen paino labeleille. Varaa pillerimuoto yhdelle komponentille. |
| 7 | kohtalainen | Kaksi linkkiä samaan asiaan eri tyyleillä ("Check access and directions ↗" alleviivattu, "OPEN OFFICIAL DETAILS ↗" uppercase). Lisäksi Directions-nappi tekee kolmannen polun. | detail-paneeli | 07, 08 | Yksi ensisijainen (Directions) ja yksi toissijainen linkki, sama tyyli. |
| 8 | kohtalainen | Mobiilissa "All"-chip ja "All categories" -dropdown ovat päällekkäiset. Kun Tennis on valittu, dropdown sanoo yhä "All categories". | mobiili filtteririvi | 11, 13 | Yksi kontrolli, joka näyttää valitun lajin nimen. |
| 9 | kohtalainen | Mobiilin detail-sheet peittää kartan kokonaan, eikä sijaintia näe. Header ja haku vievät ~290 px. | mobiili detail | 15 | Sheet puolikorkeuteen ja pinni näkyviin yläpuolelle. Kutista header ja haku detail-tilassa. |
| 10 | pieni | Datan toistoa: Facilities-listassa sama osoite 6×, listan rivillä "Specific sports are not listed in the source data yet." vaikka Tennis-suodatin on päällä, ja "Price and access aren't listed…" näkyy apulauseena. | lista, detail | 04, 08 | Piilota toistuva osoite, kun se on sama kuin paikan osoite. Näytä puuttuva data hiljaisena tilana, ei lauseena. |
| 11 | pieni | Desktopin lajichipit ovat reunattomia, mobiilissa reunallisia harmaita. Tennis-chipin hover on lähes huomaamaton. | chipit | 02, 12 | Yksi chip-spesifikaatio kaikkiin breakpointeihin, näkyvämpi hover. |
| 12 | pieni | Otsikon alla "The easiest way… • Work in progress" ja oikealla tyhjää. Paneelin alaosa on tyhjä, kun Facilities on kiinni. | header, detail | 01, 07 | Poista "Work in progress" portfoliosta, tiivistä header ja täytä tai lyhennä paneeli. |

## 5. Mikä toimi
- Typografia (geometrinen sans, selkeä nimi–laji–osoite-hierarkia listassa) on rauhallinen ja luettava.
- Listarivin hover-kortti on hienovarainen ja hyvä.
- Lajikuvakkeet ovat yhtenäistä line-tyyliä.
- Tehtävä onnistuu nopeasti, ja mobiilin bottom sheet ja kategoriaruudukko ovat oikeaa mallia.
- Privacy-banneri on rehellinen ja valinnat ovat tasavertaiset.
