"""Criterion: GET /api/dashboard risponde 200 con i campi richiesti dopo il refactor di routers/dashboard.py."""


def test_dashboard_returns_expected_fields(client):
    resp = client.get("/dashboard")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    expected_fields = [
        "lavori_in_corso",
        "ore_mese",
        "valore_ore_mese",
        "mese_corrente",
        "materiali_sotto_scorta",
        "ultimi_lavori",
        "preventivi_scaduti",
    ]
    for field in expected_fields:
        assert field in data, f"missing field {field} in {data}"
    assert isinstance(data["mese_corrente"], str)
    assert isinstance(data["ultimi_lavori"], list)
    assert isinstance(data["materiali_sotto_scorta"], list)
    assert isinstance(data["preventivi_scaduti"], list)
