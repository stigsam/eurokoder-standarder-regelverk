#!/usr/bin/env python3
"""Kontroller datafilene i data/ før de publiseres.

Siden er avhengig av eksakte feltnavn og statusverdier (filtre, farger og
nøkkeltall bruker dem), så dette skriptet stopper oppdateringer som ville
gitt tomme tabeller eller feil tall.

Bruk:  python verktoy/sjekk_data.py
Avslutter med kode 0 når alt er i orden, ellers 1 med en liste over feil.
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
DATO = re.compile(r"^\d{4}-\d{2}-\d{2}$")

SKJEMA = {
    "deler": {
        "felt": ["del", "eurokode", "tittel", "cen_aar", "sn_aar", "status", "nasjonalt_tillegg", "kilde"],
        "verdier": {
            "eurokode": {f"EN 199{i}" for i in range(10)},
            "status": {"SN-EN førstandard", "Publisert av CEN", "Vedtatt i CEN"},
            "nasjonalt_tillegg": {"Under utarbeiding", "Publisert"},
        },
        "unik": "del",
    },
    "endringer": {
        "felt": ["id", "eurokode", "del", "tema", "endring", "type", "grunnlag"],
        "verdier": {
            "eurokode": {"Alle"} | {f"EN 199{i}" for i in range(10)},
            "type": {"Ny del", "Ny metode", "Nytt innhold", "Omstrukturering", "Revisjon", "Forenkling"},
        },
        "unik": "id",
    },
    "endringsblad": {
        "felt": ["endringsblad", "del", "status", "frist", "innhold", "grunnlag"],
        "verdier": {"status": {"Vedtatt", "Høring", "Under utarbeiding"}},
        "datoer": ["frist"],
        "unik": "endringsblad",
    },
    "milepaeler": {
        "felt": ["id", "dato", "hendelse", "aktor", "presisjon"],
        "verdier": {"aktor": {"EU/CEN", "Norge"}, "presisjon": {"Eksakt", "Omtrentlig"}},
        "datoer": ["dato"],
        "paakrevd_dato": ["dato"],
        "unik": "id",
        "maa_ha_id": ["dow"],
    },
    "nye_eurokoder": {
        "felt": ["dokument", "omrade", "tittel", "status", "merknad", "grunnlag"],
        "verdier": {},
        "unik": "dokument",
    },
    "regelverk": {
        "felt": ["id", "omraade", "dokument", "tittel", "gjeldende", "status", "neste", "dato", "presisjon", "grunnlag", "kilde"],
        "verdier": {
            "omraade": {"TEK17 og forskrifter", "NS-standarder", "Kartverket / SOSI"},
            "status": {"Ny utgave", "Høring avsluttet", "Varslet høring", "Under revisjon", "Gjeldende", "Tilbaketrukket"},
            "presisjon": {"Eksakt", "Omtrentlig", None},
        },
        "datoer": ["dato"],
        "unik": "id",
    },
}


def main() -> int:
    feil = []

    for navn, s in SKJEMA.items():
        fil = DATA / f"{navn}.json"
        try:
            rader = json.loads(fil.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            feil.append(f"{fil.name}: kan ikke leses som JSON ({e})")
            continue
        if not isinstance(rader, list) or not rader:
            feil.append(f"{fil.name}: skal være en ikke-tom liste")
            continue
        sett = set()
        for i, r in enumerate(rader):
            hvor = f"{fil.name} rad {i + 1}"
            mangler = [f for f in s["felt"] if f not in r]
            if mangler:
                feil.append(f"{hvor}: mangler felt {mangler}")
            for felt, lovlige in s["verdier"].items():
                if felt in r and r[felt] not in lovlige:
                    feil.append(f"{hvor}: {felt} = {r[felt]!r} er ikke en kjent verdi {sorted(map(str, lovlige))}")
            for felt in s.get("datoer", []):
                v = r.get(felt)
                if v is not None and not (isinstance(v, str) and DATO.match(v)):
                    feil.append(f"{hvor}: {felt} = {v!r} skal være ÅÅÅÅ-MM-DD eller null")
            for felt in s.get("paakrevd_dato", []):
                if not r.get(felt):
                    feil.append(f"{hvor}: {felt} må ha en dato")
            nokkel = r.get(s["unik"])
            if nokkel in sett:
                feil.append(f"{hvor}: {s['unik']} = {nokkel!r} finnes flere ganger")
            sett.add(nokkel)
        for m in s.get("maa_ha_id", []):
            if m not in sett:
                feil.append(f"{fil.name}: mangler rad med id {m!r} (brukes av nøkkeltallet)")

    try:
        meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
        if not DATO.match(str(meta.get("sist_kontrollert", ""))):
            feil.append("meta.json: sist_kontrollert skal være ÅÅÅÅ-MM-DD")
        for navn in SKJEMA:
            k = meta.get("kilder", {}).get(navn)
            if not k or not all(k.get(f) for f in ("tittel", "beskrivelse", "oppdatert")):
                feil.append(f"meta.json: kilder.{navn} mangler tittel, beskrivelse eller oppdatert")
            elif not DATO.match(k["oppdatert"]):
                feil.append(f"meta.json: kilder.{navn}.oppdatert skal være ÅÅÅÅ-MM-DD")
    except Exception as e:  # noqa: BLE001
        feil.append(f"meta.json: kan ikke leses ({e})")

    if feil:
        print("Fant feil i datafilene:")
        for f in feil:
            print(" -", f)
        return 1
    print("Datafilene er i orden.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
