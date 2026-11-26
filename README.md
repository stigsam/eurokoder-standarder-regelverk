# Eurokoder, standarder og regelverk

En statisk nettside som gir oversikt over 2. generasjon eurokoder og annet regelverk som er relevant for byggingeniører:

- status for alle deler av 2. generasjon (EN 1990–1999), med norsk førstandard (SN-EN) og nasjonale tillegg
- milepæler for innføringen i Europa og Norge
- de viktigste faglige endringene, kommende endringsblad (A1) og nye eurokoder (glass, FRP m.fl.)
- TEK17 og andre forskrifter, sentrale NS-standarder og Kartverkets standarder for geografisk informasjon

Siden er ren HTML, CSS og JavaScript. Den har ingen byggesteg, ingen tjenerkode og ingen eksterne avhengigheter ved kjøring (d3 ligger lokalt i prosjektet). Dataene ligger som JSON-filer i `data/`.

Datagrunnlaget ble sist kontrollert 05.11.2026. Statusene endrer seg, så sjekk alltid gjeldende utgave hos Standard Norge, DiBK og Geonorge før bruk i prosjektering.

## Kjøre lokalt

Siden henter JSON-filene med `fetch`, og det fungerer ikke når `index.html` åpnes direkte som fil (`file://`). Start en enkel lokal webtjener i prosjektmappen:

```bash
python -m http.server 8000
```

Åpne deretter <http://localhost:8000/> i nettleseren.

(Alternativt: `npx serve .` eller «Live Server» i VS Code/Positron.)

## Struktur

```
index.html                 Selve siden (innhold og oppsett)
assets/
  css/style.css            Designtokens, grunnoppsett og dashboardets stiler
  js/dash.js               Laster data/*.json og tegner seksjonene (dash.data/calc/draw)
  js/app.js                Dashboardets egne beregninger, diagrammer, tabeller og filtre
  js/vendor/d3.min.js      d3 v7.9.2 (lokal kopi, ISC-lisens i d3-LICENSE.txt)
  favicon.svg
data/
  deler.json               Eurokode-deler, 2. generasjon
  endringer.json           Hovedendringer i 2. generasjon
  endringsblad.json        Kommende endringsblad (A1)
  milepaeler.json          Milepæler for innføring
  nye_eurokoder.json       Nye eurokoder og CEN/TS
  regelverk.json           Andre standarder og regelverk
.nojekyll                  Ber GitHub Pages servere filene som de er
```

### Oppdatere data

Rediger JSON-filene i `data/` og publiser på nytt (commit og push). Tall, diagrammer og tabeller beregnes fra filene hver gang siden åpnes. Titler, beskrivelser og oppdateringsdato for hver datakilde, som vises under «Kilder og datagrunnlag», ligger øverst i `assets/js/dash.js`.

## Publisere med GitHub Pages

1. Opprett et repository på GitHub, for eksempel `eurokoder-standarder-regelverk`, og push koden:
   ```bash
   gh repo create eurokoder-standarder-regelverk --public --source . --remote origin --push
   ```
   (eller opprett repoet på github.com og kjør `git remote add origin …` og `git push -u origin main`).
2. På GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, velg grenen `main` og mappen `/ (root)`, og trykk **Save**.
3. Etter et minutt eller to er siden tilgjengelig på
   `https://<github-brukernavn>.github.io/eurokoder-standarder-regelverk/`

Lenken kan deles direkte, for eksempel i Microsoft Teams, og mottakeren trenger verken Claude eller noen innlogging. Alle stier i prosjektet er relative, så siden virker både på denne adressen og lokalt.

Merk: GitHub Pages fra et privat repository krever en betalt GitHub-plan. Med gratis konto må repoet være offentlig, og da er også datafilene offentlige.

## Opprinnelse

Siden er en selvstendig versjon av et dashboard som først ble laget som Claude-artifact. Innhold, data og utseende er overført uendret så langt det lar seg gjøre; se kommentarene øverst i `assets/js/dash.js` og `assets/css/style.css` for hva som erstatter Claude-miljøet.
