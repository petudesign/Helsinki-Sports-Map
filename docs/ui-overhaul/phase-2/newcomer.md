# Persoona: newcomer (englanninkielinen tulokas)

## 1. Persoona ja tehtävä

Torontosta kaksi viikkoa sitten Helsinkiin muuttanut, puhuu vain englantia eikä tunne yhtään kaupunginosan nimeä. Asuu "Central Stationin lähellä". Käyttää puhelinta (390×844) ja välillä läppäriä (1440×900). Tehtävä: löytää jalkapallopaikka tai kuntosali kävely- tai joukkoliikennematkan päästä Central Stationilta, avata se ja selvittää, miten sinne pääsee julkisilla.

## 2. Onnistuiko

**Osittain.** Löysin paikan ja sain kävelyreitin Central Stationilta, mutta julkisen liikenteen reittiä en saanut kertaakaan, en puhelimella enkä läppärillä.

- Askelmäärä: mobiilin onnistunut polku 13 askelta. Mukana harha-askeleet (Central Station -haku pääkentässä, suodattimet, lista) yhteensä noin 18. Läppärillä noin 10 askelta.
- Arvioitu aika: 6–8 min mobiilissa, noin 3 min läppärillä.

Polku:
1. Ensilataus. UI on englanniksi, mutta kartalla on vain suomenkielisiä alueiden nimiä (Kallio, Töölö, Pasila). Central Stationia ei ole merkitty, eikä siitä ole kuvaketta. Tietosuojabanneri peittää alaosan → "Only necessary". `01-first-load.png`
2. Napautus hakuun ja "football" → 81 paikkaa. Kartta ei siirry minnekään, eikä etäisyyksiä näytetä. `03-search-football.png`
3. Facility list avattuna: aakkosjärjestys, ei etäisyyttä eikä aluetta. Nimet ovat suomea ("Alppilan lukio", "Botby grundskola"), enkä tiedä, että ne ovat kouluja. `04-football-list.png`
4. Kokeilin pääkenttään "Central Station" → "0 places" ilman vihjettä siitä, että osoitehaku on muualla. `05-search-central-station.png`
5. Avasin Filters-valikon etsiessäni "near me"- tai etäisyysjärjestystä. Sellaista ei ole. `06-filters.png`
6. Muiden englanninkielisten sanojen tarkistus: "soccer" (81), "gym" (637), "swimming" (78) ja "pool" (32) toimivat hyvin. `07-search-*.png`
7. Arvasin, että keskusta on isomman "Helsinki"-tekstin kohdalla, ja zoomasin kaksoisnapautuksella. Kartalle tuli englanninkielinen "CITY CENTRE" -teksti (hyvä), mutta asemaa ei edelleenkään ole. Lista näyttää yhä "81 places", vaikka se lupaa "visible sports facilities". `08-zoom-center.png`
8. Napautin Hakaniemen pistettä → kartta hyppäsi suoraan 100 m:n zoomiin ja kortti jäi kiinni. `09-tap-hakaniemi-pin.png`
9. Kortti avattuna: osoite, Directions, "Price and access aren't listed…" ja lajit. Aukioloaikoja, etäisyyttä tai joukkoliikennetietoa ei ole. Noin puolet paneelista on tyhjää. `10-card-open.png`
10. Directions → reittipaneeli aukeaa. Samalla "football"-haku katoaa (kartalla näkyvät kaikki paikat), ja valitun paikan pisteen tarrana lukee "Tempaus-Areena Hakaniemi" eikä "Arena Center Hakaniemi". `13-after-directions.png`
11. Lähtöpisteeksi "Central Station" → punainen virhe "No address suggestions found. Check the street name and house number." Sama virhe tuli myös hauilla "Helsinki Central Station", "railway station" ja "Rautatieasema". "Kaivokatu 1" antoi virheen "Cannot reach the address service". `14-start-central-station.png`
12. Painoin silti "Find route" → reitti piirtyi oikein rautatieasemalta (Walk 19 min, Bike 11 min, Car 7 min). Vanha virheteksti jäi kuitenkin näkyviin. `15-find-route-central.png`
13. Public transport -painike on harmaa, eikä siinä ole aikaa. Napautus ei tee mitään, eikä selitystä näytetä, ei myöskään 10 s odotuksen jälkeen. `16-public-transport.png`, `18-public-transport-wait.png`
14. Läppäri: "Gym"-pikavalinta → 440 paikkaa. Mukana on paljon "Outdoor gym"- ja "kuntoportaat"-kohteita, jotka eivät ole kuntosaleja. `19-desktop-gym.png`, `20-desktop-gym-chip.png`, `21-desktop-gym-zoom.png`
15. Zoomasin keskustaan, jossa on paljon kuntosaleja (Fressi Kamppi, ELIXIA Citycenter jne.). Ratapiha erottuu kartalla, mutta asema-alueen nimet ovat suomeksi ("Asema-aukio", "Rautatientori"). `22-desktop-cluster.png`, `23-desktop-gym-card.png`
16. Directions → lähtökenttä ei saanut fokusta, joten kirjoittamani teksti katosi ja kartta himmeni. `25-desktop-start-typed.png`
17. Klikkasin kenttää, kirjoitin "Central Station" ja painoin Find route → kävelyreitti 8 min / 564 m oikein asemalta. Joukkoliikenne oli taas harmaana, ja "No address suggestions found" näkyi edelleen. `27-desktop-route.png`

## 3. Pisteet 1–5

| Osa-alue | Pisteet | Perustelu |
|---|---|---|
| Selkeys | 3 | Englanninkielinen UI ja lajihaku toimivat, mutta kartalla ja paikkojen nimissä ei ole englanninkielisiä orientaatiopisteitä, eikä listassa ole etäisyyksiä. |
| Luottamus | 2 | "No address suggestions found" näkyy, vaikka reitti löytyy. Tarra ja kortti näyttävät eri nimeä. Lista lupaa "visible" mutta näyttää kaikki paikat. |
| Tehtävän onnistuminen | 3 | Paikka ja kävelyreitti asemalta löytyivät, joukkoliikennereittiä ei saanut lainkaan. |
| Nopeus | 3 | Läppärillä nopea. Mobiilissa jouduin arvaamaan keskustan sijainnin ja tekemään harha-askeleita. |
| Mobiilikäyttö | 3 | Kortti ja reittipaneeli toimivat kosketuksella, mutta kortti peittää koko kartan, pisteen napautus hyppää 100 m:n zoomiin ja reittipaneeli vie puolet näytöstä. |

## 4. Löydökset vakavuusjärjestyksessä

| # | vakavuus | mitä | missä (screen + element) | kuvatiedosto | korjausehdotus |
|---|---|---|---|---|---|
| 1 | kriittinen | Public transport -tila on aina harmaa ja reagoimaton, eikä mitään selitystä näytetä. Tehtävän ydinosa ("miten pääsen julkisilla") ei onnistu, eikä appi ohjaa esim. HSL-reittihakuun. | Reittipaneeli → kulkutapapainikkeet, bussi-ikoni | 16-public-transport.png, 18-public-transport-wait.png, 27-desktop-route.png | Näytä joukkoliikenneaika ja -reitti. Jos se ei ole saatavilla, näytä teksti "Public transport times unavailable" ja linkki valmiiksi täytettyyn HSL Journey Planneriin (englanninkielinen versio). |
| 2 | vakava | Lähtöpisteen haku antaa "No address suggestions found. Check the street name and house number." hauille "Central Station", "Helsinki Central Station", "railway station" ja "Rautatieasema", mutta Find route löytää silti oikean paikan. Virhe jää näkyviin myös onnistuneen reitin jälkeen. "Kaivokatu 1" antoi eri virheen ("Cannot reach the address service"). | Reittipaneeli → Starting point -kenttä ja virheteksti | 14-start-central-station.png, 15-find-route-central.png, 27-desktop-route.png | Lisää maamerkit (Central Station / Rautatieasema, Kamppi, Hakaniemi jne.) ehdotuksiin englanniksi. Tyhjennä virhe, kun reitti onnistuu. Virheen ohjeen pitäisi kertoa, että myös paikan nimi käy. |
| 3 | vakava | Lista ei kerro etäisyyttä, eikä sitä voi järjestää läheisyyden mukaan valitusta pisteestä. "Near me"- tai "near…"-valintaa ei ole. Paikallistuntemuksetta ei tiedä, mikä 81:stä on lähellä. | Facility list ja Filters-valikko | 04-football-list.png, 06-filters.png | Lisää "Sort by distance" ja "Near: [my location / address]" -valinta. Näytä listarivillä etäisyys ja kaupunginosa. |
| 4 | vakava | Pääkentän haku "Central Station" antaa "0 places" ilman ohjetta. Haku ei ymmärrä paikkoja tai osoitteita, vaikka placeholder on "Search by place or sport". | Yläosan hakukenttä | 05-search-central-station.png | Joko tue osoite- ja maamerkkihakua (keskitä kartta) tai näytä 0 tuloksen kohdalla "Looking for an address? Use Directions / Set location". Placeholderiksi esim. "Search by venue name or sport". |
| 5 | kohtalainen | Lista sanoo "Keyboard-friendly list of visible sports facilities", mutta laskuri ja lista eivät muutu zoomatessa (81 ja 440 pysyvät samoina). | Facility list -otsikko ja -laskuri | 08-zoom-center.png, 21-desktop-gym-zoom.png | Suodata lista karttanäkymän mukaan tai muuta teksti (esim. "All matching facilities"). |
| 6 | kohtalainen | Kartalla ei ole englanninkielisiä orientaatiopisteitä: Central Stationia ei ole merkitty, ja asema-alueella lukee "Asema-aukio" ja "Rautatientori". Ainoa englanninkielinen nimi on "CITY CENTRE". | Kartta, keskusta | 01-first-load.png, 22-desktop-cluster.png, 23-desktop-gym-card.png | Lisää EN-tilaan maamerkkikuvakkeet (Central Station, metroasemat) ja käytä basemapissa englanninkielisiä nimiä, jos niitä on saatavilla. |
| 7 | kohtalainen | Directions-napautuksen jälkeen aktiivinen "football"-haku katoaa ja kartalle tulevat kaikki paikat. Valitun pisteen tarra on "Tempaus-Areena Hakaniemi", kun kortissa lukee "Arena Center Hakaniemi". Ei tiedä, onko kyse samasta paikasta. | Reittinäkymä, kartta ja kortin otsikko | 13-after-directions.png | Säilytä haku ja suodatus reittitilassa. Korosta valittu kohde niin, että sen tarra on sama kuin kortin otsikko. |
| 8 | kohtalainen | Paikkojen nimet ovat pelkkää suomea tai ruotsia eikä tyyppiä ole avattu ("lukio", "peruskoulu", "grundskola", "liikuntapuisto", "kuntoportaat"). En tiedä, että ne ovat koulujen saleja, joihin pääsee vain vuorovarauksella. | Facility list ja kortit | 04-football-list.png, 21-desktop-gym-zoom.png | Näytä EN-tilassa paikan tyyppi englanniksi listarivillä (esim. "School gym hall · booking needed"). Kortissa on jo "Sports hall" ja "Fitness centre", joten sama tieto kannattaa nostaa listaan. |
| 9 | kohtalainen | "gym"-haku ja Gym-pikavalinta tuovat mukaan "Outdoor gym"- ja "kuntoportaat"-kohteet (ulkoportaat). Persoonalle "gym" tarkoittaa sisäkuntosalia. | Gym-chip ja "gym"-haku | 07-search-gym.png, 20-desktop-gym-chip.png | Erota "Gym (indoor)" ja "Outdoor gym" tai järjestä sisäkuntosalit ensin. |
| 10 | kohtalainen | Läppärillä Directions-napin jälkeen lähtökenttä ei saa fokusta, joten kirjoitettu teksti katoaa. Lisäksi kartta himmenee ilman selvää syytä. | Desktop, reittipaneeli | 25-desktop-start-typed.png | Siirrä fokus Starting point -kenttään automaattisesti. Älä himmennä karttaa tai kerro syy. |
| 11 | pieni | Kortista puuttuu aukioloaika ja hintatieto ("Price and access aren't listed…"). "Check access and directions ↗" vie operaattorin sivulle (http://www.arenacenter.fi/…), joka on todennäköisesti suomeksi, eikä sieltä löydy joukkoliikenneohjeita. | Kortti | 10-card-open.png | Nimeä linkki rehellisesti ("Operator website"). Lisää erillinen "Plan trip with HSL" -linkki. |
| 12 | pieni | Mobiilissa pisteen napautus hyppää suoraan 100 m:n zoomiin, jolloin konteksti katoaa (missä asema on suhteessa paikkaan). Avattu kortti peittää koko kartan, ja puolet paneelista on tyhjää. | Mobiili, kartta ja bottom sheet | 09-tap-hakaniemi-pin.png, 10-card-open.png | Käytä maltillisempaa zoomia (esim. 300–500 m). Avaa kortti puolikorkeuteen niin, että kartta jää näkyviin. |
| 13 | pieni | Pääkentän "0 places" näkyy vain alapaneelissa pienellä, eikä tyhjälle tulokselle ole tilaa. | Mobiili, Facility list -laskuri | 05-search-central-station.png | Näytä tyhjän tuloksen viesti kartan päällä ehdotuksineen. |

## 5. Mikä toimi

- UI aukesi suoraan englanniksi (en-US-selain), ja kaikki napit, suodattimet ja lajinimet ovat englantia.
- Englanninkielinen lajihaku toimii hyvin: "football", "soccer" (synonyymi), "gym", "swimming" ja "pool" antavat kaikki järkeviä tuloksia.
- Läppärin lajipikavalinnat (Football, Gym, Swimming…) ovat nopeita ja selkeitä.
- Reittitoiminto on sovelluksen sisällä. Kun "Central Station" lopulta hyväksyttiin, reitti piirtyi oikein asemalta, ja kävely-, pyörä- ja autoajat näkyivät heti.
- Kortin rakenne (osoite, iso Directions-nappi, lajit, tyyppi englanniksi kuten "Sports hall" ja "Fitness centre") on selkeä.
- Tietosuojabanneri on selkeä ja helppo ohittaa valinnalla "Only necessary".
