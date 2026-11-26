# Vedlikehold

Notater for den som vedlikeholder siden. For brukere, se [README.md](README.md).

Siden er ren HTML, CSS og JavaScript uten byggesteg, tjenerkode eller eksterne avhengigheter ved kjøring (d3 ligger lokalt). Alt innhold ligger som JSON-filer i `data/`.

## Kjøre lokalt

Siden henter JSON-filene med `fetch`, og det fungerer ikke når `index.html` åpnes direkte som fil (`file://`). Start en enkel webtjener i prosjektmappen:

```bash
python -m http.server 8000
```

Åpne deretter <http://localhost:8000/>.

## Struktur

```
index.html                 Selve siden (innhold og oppsett)
assets/
  css/style.css            Designtokens, grunnoppsett og sidens stiler
  js/dash.js               Laster data/*.json og tegner seksjonene (dash.data/calc/draw)
  js/app.js                Beregninger, diagrammer, tabeller og filtre
  js/vendor/d3.min.js      d3 v7.9.2 (lokal kopi, ISC-lisens i d3-LICENSE.txt)
  favicon.svg
data/
  deler.json               Eurokode-deler, 2. generasjon
  endringer.json           Hovedendringer i 2. generasjon
  endringsblad.json        Kommende endringsblad (A1)
  milepaeler.json          Milepæler for innføring
  nye_eurokoder.json       Nye eurokoder og CEN/TS
  regelverk.json           Andre standarder og regelverk
  meta.json                Dato for siste kontroll, kildebeskrivelser og endringslogg
verktoy/
  sjekk_data.py            Kontrollerer datafilene før publisering
.nojekyll                  Ber GitHub Pages servere filene som de er
```

## Oppdatere data

All oppdatering av innholdet skjer i `data/`:

1. Rett JSON-filene som har endret seg.
2. I `data/meta.json`: sett `sist_kontrollert` til dagens dato (ÅÅÅÅ-MM-DD), oppdater `oppdatert` og eventuelt `beskrivelse` for kildene som er kontrollert, og legg en linje i `logg`.
3. Kjør kontrollen, som stopper feil feltnavn, ukjente statusverdier og ugyldige datoer:
   ```bash
   python verktoy/sjekk_data.py
   ```
4. Commit og push. GitHub Pages oppdaterer siden i løpet av et par minutter.

Statusverdiene må være nøyaktig de samme som filtrene og fargene på siden bruker (for eksempel «Høring avsluttet», «Varslet høring»). Trengs en ny verdi, må den også legges inn i `index.html`, `assets/js/app.js` og `verktoy/sjekk_data.py`.

## Månedlig kontroll

En planlagt oppgave går gjennom kildene (Standard Norge, CEN/JRC, DiBK, KDD og Geonorge) den 2. i hver måned, oppdaterer filene i `data/`, kjører kontrollen og leverer endringene som en patch med en oversikt over hva som er endret. Patchen legges inn slik:

```bash
git am <filnavn>.patch
git push
```

## Publisering med GitHub Pages

Siden publiseres fra grenen `main`, mappen `/ (root)` (Settings → Pages → Deploy from a branch). Alle stier er relative, så siden virker både på GitHub Pages og lokalt. GitHub Pages krever offentlig repo med gratis GitHub-konto, og da er også datafilene offentlige.
