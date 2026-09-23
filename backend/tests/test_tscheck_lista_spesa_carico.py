"""Criterion: carico da lista - spuntare "comprato" su una voce da listino carica la
giacenza del materiale; togliere la spunta la riporta al valore iniziale; ripetere
la spunta non fa doppi carichi (idempotenza via campo "caricato")."""

import uuid


def _crea_materiale(client, suffix, giacenza=5.0):
    resp = client.post(
        "/materiali",
        json={
            "nome": f"tscheck-materiale-carico-{suffix}",
            "categoria": "Cavi e Conduttori",
            "unita_misura": "pz",
            "prezzo_unitario": 10.0,
            "prezzo_costo": 6.0,
            "quantita_disponibile": giacenza,
            "scorta_minima": 1.0,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _crea_lavoro(client, suffix):
    resp = client.post(
        "/lavori",
        json={
            "titolo": f"tscheck-lista-carico-{suffix}",
            "cliente_nome": f"Cliente TScheck {suffix}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_carico_da_lista_incrementa_e_decrementa_giacenza(client):
    suffix = uuid.uuid4().hex[:8]
    giacenza_iniziale = 5.0
    materiale_id = _crea_materiale(client, suffix, giacenza_iniziale)
    lavoro_id = _crea_lavoro(client, suffix)

    resp = client.post(
        f"/lavori/{lavoro_id}/lista",
        json={
            "materiale_id": materiale_id,
            "quantita": 3,
            "unita": "pz",
            "prezzo_stimato": 6.0,
        },
    )
    assert resp.status_code == 201 or resp.status_code == 200, resp.text
    lavoro = resp.json()
    item = next(i for i in lavoro["lista_spesa"] if i["materiale_id"] == materiale_id)
    item_id = item["id"]

    # spunta comprato -> giacenza aumenta di 3
    resp = client.patch(f"/lavori/{lavoro_id}/lista/{item_id}", json={"comprato": True})
    assert resp.status_code == 200, resp.text
    mat = client.get(f"/materiali/{materiale_id}").json() if False else None
    mat_resp = client.get("/materiali")
    mat = next(m for m in mat_resp.json() if m["id"] == materiale_id)
    assert mat["quantita_disponibile"] == giacenza_iniziale + 3, mat

    # ripetere la spunta (comprato=True di nuovo) non deve caricare doppio
    resp = client.patch(f"/lavori/{lavoro_id}/lista/{item_id}", json={"comprato": True})
    assert resp.status_code == 200, resp.text
    mat_resp = client.get("/materiali")
    mat = next(m for m in mat_resp.json() if m["id"] == materiale_id)
    assert mat["quantita_disponibile"] == giacenza_iniziale + 3, "doppio carico rilevato: " + str(mat)

    # togliere la spunta -> torna al valore iniziale
    resp = client.patch(f"/lavori/{lavoro_id}/lista/{item_id}", json={"comprato": False})
    assert resp.status_code == 200, resp.text
    mat_resp = client.get("/materiali")
    mat = next(m for m in mat_resp.json() if m["id"] == materiale_id)
    assert mat["quantita_disponibile"] == giacenza_iniziale, mat
