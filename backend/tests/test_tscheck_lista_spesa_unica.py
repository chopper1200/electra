"""Criterion: GET /api/lavori/lista-spesa/unica aggrega le voci non comprate di tutti
i lavori non completati: la stessa voce (materiale) presente in due cantieri viene
sommata in una sola riga, mancante = richiesta - giacenza, totale stimato coerente,
elenco cantieri per riga."""

import uuid


def _crea_materiale(client, suffix, giacenza=2.0):
    resp = client.post(
        "/materiali",
        json={
            "nome": f"tscheck-materiale-unica-{suffix}",
            "categoria": "Cavi e Conduttori",
            "unita_misura": "pz",
            "prezzo_unitario": 10.0,
            "prezzo_costo": 5.0,
            "quantita_disponibile": giacenza,
            "scorta_minima": 1.0,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _crea_lavoro(client, suffix, titolo_suffix, stato="in_corso"):
    resp = client.post(
        "/lavori",
        json={
            "titolo": f"tscheck-lavoro-unica-{suffix}-{titolo_suffix}",
            "cliente_nome": f"Cliente TScheck {suffix}",
            "stato": stato,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_lista_spesa_unica_aggrega_stessa_voce_tra_cantieri(client):
    suffix = uuid.uuid4().hex[:8]
    giacenza = 2.0
    materiale_id = _crea_materiale(client, suffix, giacenza)

    lavoro_a = _crea_lavoro(client, suffix, "a")
    lavoro_b = _crea_lavoro(client, suffix, "b")

    resp = client.post(
        f"/lavori/{lavoro_a}/lista",
        json={"materiale_id": materiale_id, "quantita": 4, "prezzo_stimato": 5.0},
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(
        f"/lavori/{lavoro_b}/lista",
        json={"materiale_id": materiale_id, "quantita": 6, "prezzo_stimato": 5.0},
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/lavori/lista-spesa/unica")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "righe" in data and "totale_stimato" in data and "cantieri_aperti" in data

    riga = next((r for r in data["righe"] if r.get("materiale_id") == materiale_id), None)
    assert riga is not None, f"riga per materiale non trovata: {data['righe']}"

    assert riga["quantita_richiesta"] == 10.0, riga
    assert riga["giacenza"] == giacenza, riga
    assert riga["mancante"] == 10.0 - giacenza, riga
    cantieri_ids = {c["lavoro_id"] for c in riga["cantieri"]}
    assert lavoro_a in cantieri_ids and lavoro_b in cantieri_ids, riga["cantieri"]


def test_lista_spesa_unica_esclude_lavori_completati(client):
    suffix = uuid.uuid4().hex[:8]
    materiale_id = _crea_materiale(client, suffix, 0.0)
    lavoro_completato = _crea_lavoro(client, suffix, "done", stato="completato")

    resp = client.post(
        f"/lavori/{lavoro_completato}/lista",
        json={"materiale_id": materiale_id, "quantita": 5, "prezzo_stimato": 5.0},
    )
    assert resp.status_code == 200, resp.text

    resp = client.get("/lavori/lista-spesa/unica")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    riga = next((r for r in data["righe"] if r.get("materiale_id") == materiale_id), None)
    assert riga is None, f"voce di lavoro completato non deve apparire: {riga}"
