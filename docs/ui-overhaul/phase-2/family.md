# Persoona: family

## 1. Persoona ja tehtävä
Kahden lapsen (6 ja 9 v.) vanhempi Herttoniemestä, suomenkielinen, ei jaa sijaintia. Etsii lähimmän uimahallin lauantaiksi: aikuisen ja lasten lippuhinnat sekä lauantain aukioloajat. Ensin läppäri (1440×900), sitten puhelin (390×844).

## 2. Onnistuiko
**Osittain.** Löysin Itäkeskuksen uimahallin omalla paikallistuntemuksellani, mutta sovellus ei kertonut, mikä halli on lähin. Hintoja ja aukioloaikoja ei löytynyt mistään. Ajamaan en lähtisi tämän tiedon varassa, vaan tarkistaisin asiat muualta.
Askelia noin 26 (läppäri 19, puhelin 7). Aikaa arviolta 12 minuuttia.

Polku:
1. Sivu avautuu englanniksi, vaikka selaimen kieli on fi-FI. Valitsen evästebannerista "Only necessary" (`01-first-load.png`).
2. Vaihdan kieleksi FI (`02-finnish.png`).
3. Kirjoitan hakuun "Herttoniemi". Tulokseksi tulee 8 paikkaa, joiden nimessä on sana Herttoniemi (kiipeily, kuntosaleja). Alueen läheisiä paikkoja tai uimahalleja ei näy (`03-search-herttoniemi.png`).
4. Kirjoitan osoitteen "Hiihtäjäntie 1": "ei löytynyt paikkoja". Osoitehakua ei ole, eikä tulosten järjestämiseen etäisyyden mukaan ole keinoa (`04-search-address.png`).
5. Kirjoitan "uimahalli": 12 paikkaa aakkosjärjestyksessä ilman etäisyyksiä. Kartta ei rajaa näkymää tuloksiin, joten Itäkeskuksen halli jää aivan reunaan (`05-search-uimahalli.png`).
6. Avaan Suodattimet. Kohderyhmä-kohdassa on vaihtoehto "Lapset ja perheet" (`06-filters.png`).
7. Valitsen "Lapset ja perheet". Tulokseksi tulee 0 paikkaa, ja ilmoitus syyttää hakua: "Haulla 'uimahalli' ei löytynyt paikkoja" (`07-family-filter.png`).
8. Poistan suodattimen ja avaan Itäkeskuksen uimahallin. Kortissa lukee "Hinta- ja käyttöoikeustietoja ei ole vielä lähdedatassa." Aukioloaikoja ei ole lainkaan (`08-itakeskus-detail.png`).
9. Avaan "Liikuntakohteet (4)". Alla on Liikuntasali, Kuntosali 1 ja 2 sekä Uimahalli, mutta näissäkään ei ole hintoja tai aikoja, eivätkä rivit ole klikattavia (`09-itakeskus-expanded.png`, `10-uimahalli-subunit.png`).
10. Painan (!)-painiketta toivoen lisätietoja. Se avaa kuitenkin raportointidialogin, joka ohjaa GitHubiin. Esc ei sulje dialogia (`11-info-button.png`, `11b-after-escape.png`).
11. Takaisin-nuoli palauttaa listaan: haku säilyy ja edellinen kohde on korostettuna. Kartta jää kuitenkin 100 m:n zoomiin (`12-back-to-list.png`).
12. Kokeilen Urheiluhallit Kontulaa. Sama ilmoitus, ei hintoja eikä aikoja (`13-kontula-detail.png`).
13. Kokeilen Uinti-pikasuodatinta: 32 paikkaa, joiden joukossa on kuntosaleja (Fit Haaga, Forever Töölö, Fressi). Sisähalleja ei voi erottaa muista (`14-uinti-chip.png`).
14. Molemmat ulkoiset linkit ("Tarkista kulku- ja käyttöohjeet" ja "Avaa viralliset tiedot") vievät liikunta.hel.fi:n etusivulle, eivät kyseisen hallin sivulle. Linkkejä en avannut.
15. Puhelimella sivu avautuu taas englanniksi. Valitsen "Only necessary" ja FI (`15-mobile-first-load.png`).
16. Haen "uimahalli". Kartta näyttää vain keskustan, eikä yksikään idän halleista näy (`16-mobile-search.png`).
17. Avaan listan. Se on hyvin luettava, mutta etäisyyksiä ei ole (`17-mobile-list.png`).
18. Avaan Itäkeskuksen: sama puuttuva tieto, ja kortti peittää kartan (`18-mobile-detail.png`).
19. Pienennän kortin ja palaan takaisin. Kartta jää kohteen zoomiin, ja lista palaa pienennettynä (`19-mobile-detail-collapsed.png`, `20-mobile-back-attempt.png`).

## 3. Pisteet 1–5
| Mittari | Pisteet | Perustelu |
|---|---|---|
| selkeys | 3 | Lista ja kortti ovat siistejä ja luettavia, mutta "Uinti" sekoittaa kuntosalit ja uimahallit, eikä (!)-painikkeen tarkoitus selviä ennen painamista. |
| luottamus | 2 | Sovellus kertoo rehellisesti, että hintatietoja ei ole. Aukioloajoista se ei sano mitään, ja "viralliset tiedot" -linkki vie yleiselle etusivulle. |
| tehtävän onnistuminen | 1 | Lähintä hallia ei voi selvittää, eikä hintoja tai lauantain aukioloaikoja löydy. |
| nopeus | 3 | Uimahallien lista löytyy nopeasti hakusanalla, mutta sen jälkeen jumitun umpikujaan. |
| mobiilikäyttö | 3 | Lista ja kortti toimivat hyvin ja kosketusalueet ovat isoja, mutta kartta ei näytä tuloksia ja kortti peittää kartan. |

## 4. Löydökset vakavuusjärjestyksessä
| # | vakavuus | mitä | missä (screen + element) | kuvatiedosto | korjausehdotus |
|---|---|---|---|---|---|
| 1 | kriittinen | Uimahallin kortissa ei ole hintoja eikä aukioloaikoja. Aukioloajoista ei ole edes "ei saatavilla" -mainintaa. | Kohdekortti, tietolohko | 08-itakeskus-detail.png, 13-kontula-detail.png | Näytä aukioloajat (vähintään linkki hallin omaan aukiolosivuun). Jos tietoa ei ole, sano se myös aukioloajoista. |
| 2 | vakava | "Lähintä" ei voi selvittää ilman sijainnin jakamista: osoite- tai aluehaku ei toimi ("Hiihtäjäntie 1" antaa 0 tulosta), eikä listassa ole etäisyyksiä tai järjestämistä. | Hakukenttä, lista | 03-search-herttoniemi.png, 04-search-address.png, 05-search-uimahalli.png | Lisää osoite- tai kaupunginosahaku, joka asettaa lähtöpisteen ja järjestää listan etäisyyden mukaan (km näkyviin). |
| 3 | vakava | Suodatin "Lapset ja perheet" pudottaa kaikki uimahallit pois (0 tulosta), ja tyhjän tuloksen ilmoitus syyttää hakusanaa. | Suodattimet > Kohderyhmä, tyhjä tila | 07-family-filter.png | Korjaa kohderyhmädata tai merkitse suodatin kattavuudeltaan rajalliseksi. Kerro tyhjässä tilassa, mikä rajaus tulokset poisti. |
| 4 | vakava | "Tarkista kulku- ja käyttöohjeet" ja "Avaa viralliset tiedot" vievät liikunta.hel.fi:n etusivulle eivätkä hallin omalle sivulle. | Kohdekortti, ulkoiset linkit | 08-itakeskus-detail.png | Linkitä kohteen omalle sivulle tai vähintään hakuun kohteen nimellä. |
| 5 | kohtalainen | Uinti-luokka ja haku "uimahalli" sekoittavat kuntosalit ja urheiluhallit uimahalleihin. Sisähallia ja maauimalaa ei voi erottaa toisistaan. | Kategoriarivi "Uinti", lista | 14-uinti-chip.png | Lisää alatyyppi (uimahalli / maauimala / kuntosalin allas) ja näytä se listarivillä. |
| 6 | kohtalainen | Kartta ei rajaa näkymää hakutuloksiin. Työpöydällä Itäkeskus jää reunaan, ja mobiilissa idän hallit eivät näy ollenkaan. | Kartta hakutuloksen jälkeen | 05-search-uimahalli.png, 16-mobile-search.png | Rajaa kartta tulosten mukaan haun ja suodatuksen jälkeen. |
| 7 | kohtalainen | Kun kortista palataan listaan, kartta jää kohteen 100 m:n zoomiin, jolloin muiden hallien vertailu ja sijoittuminen hukkuvat. | Takaisin-nuoli | 12-back-to-list.png, 20-mobile-back-attempt.png | Palauta karttanäkymä samaksi kuin ennen kortin avaamista. |
| 8 | kohtalainen | Sivu aukeaa englanniksi, vaikka selaimen kieli on suomi (myös mobiilissa). | Ensilataus, kielivalitsin | 01-first-load.png, 15-mobile-first-load.png | Valitse oletuskieli navigator.language-asetuksen perusteella. |
| 9 | pieni | (!)-painike näyttää "lisätietoja"-painikkeelta, mutta avaa GitHub-raportin. Dialogi ei sulkeudu Esc-näppäimellä. | Kortin otsikkorivi, (!) | 11-info-button.png, 11b-after-escape.png | Vaihda ikoni (esim. lippu) ja tekstiksi "Ilmoita virheestä". Sulje dialogi Esc-näppäimellä. |
| 10 | pieni | "Liikuntakohteet (4)" -lista avautuu, mutta alikohteet (esim. Uimahalli) eivät ole klikattavia eivätkä anna lisätietoa. Itäkeskuksen uimahallilla on lisäksi tunniste "Ulkokuntosali", joka hämmentää. | Kortti, Liikuntakohteet | 09-itakeskus-expanded.png, 10-uimahalli-subunit.png | Tee alikohteista avattavia tai näytä niiden tiedot. Tarkista tunnisteet. |
| 11 | pieni | Kopioteksti "Hinta- ja käyttöoikeustietoja ei ole vielä lähdedatassa" on teknistä kieltä. | Kortti, tietolohko | 08-itakeskus-detail.png | Esim. "Hintoja ja aukioloaikoja ei vielä ole tässä palvelussa – katso hallin oma sivu." |

## 5. Mikä toimi
- Evästebanneri on selkeä, ja "Only necessary" on helppo valita.
- Suomenkielinen käyttöliittymä on muuten luontevaa ("Liikuntapaikkalista", "Reittiohjeet", "Tyhjennä haku ja rajaukset").
- Haku "uimahalli" löytää hallit heti.
- Takaisin-nuoli toimii: haku säilyy, ja edellinen kohde näkyy korostettuna listassa.
- Mobiilin alalaatikko (lista ja kortti) on hyvin luettava, ja painikkeet ovat isoja.
- Sovellus myöntää rehellisesti, että hintatieto puuttuu, eikä keksi tietoja.
