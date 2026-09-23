"""Criterion: validazioni negative degli endpoint lista_spesa.

- POST /api/lavori/{id}/lista con quantita 0 -> 422
- POST senza nome ne' materiale_id -> 422
- PATCH/DELETE su item_id inesistente -> 404
- PATCH su lavoro inesistente -> 404
"""

import uuid


def _crea_lavoro(client, suffix):
    resp = client.post(
        "/lavori",
        json={
            "titolo": f"tscheck-lista-val-{suffix}",
            "cliente_nome": f"Cliente TScheck {suffix}",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_quantita_zero_returns_422(client):
    suffix = uuid.uuid4().hex[:8]
    lavoro_id = _crea_lavoro(client, suffix)
    resp = client.post(
        f"/lavori/{lavoro_id}/lista",
        json={"nome": "Voce test", "quantita": 0, "unita": "pz", "prezzo_stimato": 1.0},
    )
    assert resp.status_code == 422, resp.text


def test_senza_nome_ne_materiale_id_returns_422(client):
    suffix = uuid.uuid4().hex[:8]
    lavoro_id = _crea_lavoro(client, suffix)
    resp = client.post(
        f"/lavori/{lavoro_id}/lista",
        json={"quantita": 1, "unita": "pz", "prezzo_stimato": 1.0},
    )
    assert resp.status_code == 422, resp.text


def test_patch_item_inesistente_returns_404(client):
    suffix = uuid.uuid4().hex[:8]
    lavoro_id = _crea_lavoro(client, suffix)
    resp = client.patch(
        f"/lavori/{lavoro_id}/lista/item-non-esiste-{suffix}",
        json={"comprato": True},
    )
    assert resp.status_code == 404, resp.text


def test_delete_item_inesistente_returns_404(client):
    suffix = uuid.uuid4().hex[:8]
    lavoro_id = _crea_lavoro(client, suffix)
    resp = client.delete(f"/lavori/{lavoro_id}/lista/item-non-esiste-{suffix}")
    assert resp.status_code == 404, resp.text


def test_patch_lavoro_inesistente_returns_404(client):
    resp = client.patch(
        "/lavori/lavoro-non-esiste-tscheck/lista/item-non-esiste",
        json={"comprato": True},
    )
    assert resp.status_code == 404, resp.text
