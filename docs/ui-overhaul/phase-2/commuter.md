# Persoona: commuter (työmatkalainen, Kallio)

## 1. Persoona ja tehtävä
Työssäkäyvä aikuinen raitiovaunussa klo 17.30, iPhone (390×844), kärsivällisyyttä 60 s. Haluaa löytää lähimmän ILMAISEN ulkokoripallokentän ja päättää, lähteekö sinne ja miten sinne pääsee.

## 2. Onnistuiko
**Osittain.** Löysin ilmaiseksi merkityn koripallokentän (Leikkipuisto Vallila, Hämeentie 98) ja kävelyreitin (29 min), mutta 15 askeleella ja noin 70–75 sekunnissa (15 × ~2,5 s + lukemiseen ~30 s). 60 sekuntia ei olisi riittänyt. Lisäksi 29 minuutin kävely ei ole "lähellä": Kalliossa on useita lähempiä kenttiä, joiden hinta on "ei tiedossa", joten Ilmainen-suodatin piilotti ne. En siis voinut olla varma, että valinta oli paras. Sovellus aukesi englanniksi, mutta kieltä ei tarvinnut vaihtaa.

Polku:
1. Sovellus aukeaa, tietosuojabanneri peittää kartan alaosan → napautin "Only necessary" (01-first-load.png, 02-banner-dismissed.png)
2. Napautin hakukenttää (03-search-focus.png)
3. Kirjoitin "basketball": 284 paikkaa. Sijaintia ei kysytty, eikä kartalla näy omaa sijaintia tai "lähelläni"-painiketta (04-typed-basketball.png)
4. Napautin suodatinpainiketta oikealla ylhäällä (05-filters.png)
5. Valitsin Price → Free: 284 → 35 paikkaa (06-free-selected.png)
6. Napautin "Facility list" -otsikkoa. Mitään ei tapahtunut, ja suodatinikkuna jäi auki (07-list-open.png)
7. Napautin nuolipainiketta: lista aukesi, mutta suodatinikkuna peitti sen yläosan (08-list-chevron.png)
8. Napautin suodatinpainiketta uudelleen, jotta ikkuna sulkeutuu. Lista on aakkosjärjestyksessä eikä etäisyyksiä näy (09-popover-closed.png)
9. Pienensin listan, jotta näen kartan (10-list-collapsed.png)
10. Arvasin silmämääräisesti Kalliota lähimmän nastan ja napautin sitä: kartta zoomasi 100 m:n mittakaavaan ja nasta pysyi näkyvissä (11-tap-hermanni-pin.png)
11. Avasin tiedot: Hämeentie 98, Price Free, ei etäisyyttä (12-detail-open.png)
12. Avasin Facilities (2): "Basketball court" (13-facilities-expanded.png)
13. Directions → reittipaneeli aukesi sovelluksessa (14-directions.png)
14. Sijaintipainike → lähtöpisteeksi tuli "Kallio Church…" (15-use-my-location.png)
15. Find route → kävellen 29 min, pyörällä 11 min, autolla 6 min. Joukkoliikenne on harmaana (17-transit-tap.png) (16-route.png)

Lisätarkistukset (ei lasketa tehtävään): reitin sulkeminen tyhjensi hakukentän (18-route-closed.png). Hintasuodattimen palautus "All"-tilaan toimi (19-price-all.png, 20-all-prices-reset.png). Kallion klusterissa on useita lähempiä kenttiä (21-kallio-cluster.png), mutta ensimmäinen avaamani oli lukion sisäsali, jonka hinta oli "ei tiedossa" (22-kallio-court-detail.png).

## 3. Pisteet 1–5
| Osa-alue | Pisteet | Perustelu |
|---|---|---|
| selkeys | 3 | Haku ja suodatin löytyvät, mutta "lähellä minua" puuttuu kokonaan ja popoveri jää listan päälle |
| luottamus | 2 | "Free" pudottaa 284 → 35 eikä kerro, että hinnattomat piilotetaan. Sisä- ja ulkokenttiä ei erota toisistaan, ja "Check access and directions" vie yleiselle hel.fi-toimialasivulle |
| tehtävän onnistuminen | 3 | Ilmainen kenttä ja reitti löytyivät, mutta kenttä oli 29 min kävelymatkan päässä, ja lähemmät jäivät piiloon |
| nopeus | 2 | 15 askelta, ~70–75 s. Etäisyys selviää vasta reittihaun jälkeen |
| mobiilikäyttö | 3 | Alapaneeli ja peukaloalue toimivat, ja valittu nasta pysyy näkyvissä peek-tilassa. Avattu paneeli peittää kartan lähes kokonaan, ja Free/Paid/All-valinnat ovat pieniä tekstinappeja ylhäällä |

## 4. Löydökset vakavuusjärjestyksessä
| # | vakavuus | mitä | missä | kuvatiedosto | korjausehdotus |
|---|---|---|---|---|---|
| 1 | vakava | Sijaintia ei kysytä eikä käytetä haussa: ei "lähelläni"-painiketta, ei omaa sijaintia kartalla, ei etäisyyksiä eikä etäisyysjärjestystä. Sijainti on käytössä vain reittipaneelissa | Päänäkymä, kartan ohjaimet, Facility list | 04-typed-basketball.png, 09-popover-closed.png | Lisää kartalle "Paikanna minut" -painike. Kun sijainti on tiedossa, järjestä lista etäisyyden mukaan ja näytä "1,2 km · 15 min" listassa ja tiedoissa |
| 2 | vakava | "Free"-suodatin piilottaa ilman varoitusta paikat, joiden hinta on tuntematon (284 → 35). Lähimmät Kallion kentät katoavat, ja käyttäjä ohjautuu 29 min kävelymatkan päähän | Suodatinikkuna, Price | 06-free-selected.png, 21-kallio-cluster.png | Lisää vaihtoehto "Ilmainen tai todennäköisesti ilmainen (ulkokentät)" tai näytä teksti "35 varmasti ilmaista, 249 hinta tuntematon – näytä nekin" |
| 3 | vakava | Sisä- ja ulkokenttiä ei voi erottaa. Haku "basketball" sekoittaa koulujen saleja (esim. kuvataidelukion "Gymnastics hall") ja ulkokenttiä | Haku, suodattimet, tiedot | 22-kallio-court-detail.png | Lisää Sisällä/Ulkona-suodatin ja merkintä listaan ja tietoihin |
| 4 | kohtalainen | Suodatinikkuna ei sulkeudu, kun napautan sen ulkopuolelle tai avaan listan, vaan jää listan yläosan päälle | Suodatinpopoveri | 07-list-open.png, 08-list-chevron.png | Sulje popoveri ulkopuolisesta napautuksesta ja kun alapaneeli avataan, ja lisää "Valmis (35)" -painike |
| 5 | kohtalainen | "Facility list" -otsikon tai peek-alueen napautus ei avaa listaa. Vain pieni nuolipainike oikealla toimii | Alapaneelin peek | 07-list-open.png | Tee koko peek-palkista napautettava ja vedettävä |
| 6 | kohtalainen | Reitin sulkeminen tyhjentää hakukentän ("basketball" katoaa), mutta Free-suodatin jää päälle. Käyttäjä näkee eri tuloksia kuin hetkeä aiemmin | Reittipaneelin X → päänäkymä | 18-route-closed.png | Säilytä hakuteksti reitin sulkemisen jälkeen |
| 7 | kohtalainen | Joukkoliikenne-vaihtoehto on harmaana ilman selitystä, vaikka persoona kulkee raitiovaunulla | Reittipaneelin kulkutapavalinnat | 16-route.png, 17-transit-tap.png | Näytä syy ("Joukkoliikennereitit eivät ole vielä käytössä") tai linkki HSL:n reittioppaaseen |
| 8 | kohtalainen | "Check access and directions ↗" ja "Open official details" vievät molemmat yleiselle hel.fi:n kaupunkiympäristön toimialan sivulle, eivät paikan omalle sivulle | Paikan tiedot | 12-detail-open.png | Linkitä paikan omaan palvelukarttasivuun tai poista linkki. Älä käytä sanaa "directions" linkissä, joka ei anna reittiohjeita |
| 9 | pieni | Hinta "Free" ei kerro lähdettä eikä päivitysajankohtaa, ja aukioloajat ja valaistus puuttuvat. Iltaa klo 17.30 jälkeen marraskuussa varten valaistus olisi ratkaiseva tieto | Paikan tiedot, Price-rivi | 12-detail-open.png | Lisää lähde ja päivämäärä sekä valaistus- ja aukiolotieto, jos se on saatavilla |
| 10 | pieni | Avattu tietopaneeli peittää kartan lähes kokonaan, eikä valittua paikkaa näy | Alapaneeli, tiedot | 12-detail-open.png | Käytä puolikorkeaa välitilaa, jossa nasta näkyy paneelin yläpuolella |
| 11 | pieni | Free/Paid/All-valinnat ovat 36×36 px ja All vain 27×36 px tekstinappeja näytön yläreunassa, peukalon ulottumattomissa | Suodatinikkuna | 05-filters.png | Kasvata koko vähintään 44 px:iin ja siirrä pikasuodattimet alapaneeliin |
| 12 | pieni | Tietosuojabanneri peittää kartan alaosan ensikäynnillä. Valinnat ovat selkeät ja "Only necessary" on helppo painaa | Ensilataus | 01-first-load.png | Ok sellaisenaan. Banneria voisi lyhentää yhteen riviin |

## 5. Mikä toimi
- Haku "basketball" suodattaa kartan heti, ja paikkojen määrä päivittyy alapaneeliin.
- Suodattimen aktiivisuusmerkki (1) näkyy, ja suodattimen palautus "All"-tilaan toimii.
- Nastan napautus zoomaa paikkaan, ja valittu nasta pysyy näkyvissä peek-tilassa.
- Reittipaneeli toimii sovelluksen sisällä: sijainti tulee yhdellä napautuksella ("Kallio Church"), ja ajat näkyvät kaikille kulkutavoille kerralla.
- Kielen vaihto (EN/FI) on näkyvillä, mutta sitä ei tarvittu.
