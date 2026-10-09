"""Criterio: Busca global com Ctrl+K - API /search retorna resultados agrupados."""


def test_global_search_returns_grouped_results(auth_client):
    resp = auth_client.get("/search", params={"q": "elden"})
    assert resp.status_code == 200, f"search failed: {resp.status_code} {resp.text}"
    body = resp.json()
    assert "games" in body and "news" in body and "updates" in body and "events" in body
    assert any("elden" in g["title"].lower() for g in body["games"]), (
        f"expected a game containing 'elden', got titles: {[g['title'] for g in body['games']]}"
    )

    # Fewer than 2 chars is rejected by the API (min_length=2) -> UI shows palette-hint instead of calling it.
    short_resp = auth_client.get("/search", params={"q": "e"})
    assert short_resp.status_code == 422, f"expected 422 for too-short query, got {short_resp.status_code}"

    # A term with no matches returns empty groups (drives palette-no-results).
    empty_resp = auth_client.get("/search", params={"q": "zzzznoexiststscheck"})
    assert empty_resp.status_code == 200
    empty_body = empty_resp.json()
    assert empty_body["games"] == [] and empty_body["news"] == []
