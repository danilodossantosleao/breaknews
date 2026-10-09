"""Criterio: Adicionar jogo a biblioteca e persistencia (sem duplicar)."""


def test_add_game_persists_and_rejects_duplicate(auth_client):
    # Pick a catalog game not likely in demo library seed (search by a known slug term).
    search = auth_client.get("/games/search", params={"q": "Hollow", "limit": 5})
    assert search.status_code == 200, f"search failed: {search.status_code} {search.text}"
    games = search.json()
    assert games, "expected at least one game result for 'Hollow'"
    game_id = games[0]["id"]

    # Ensure clean state: remove any pre-existing user_game link for this game first.
    lib = auth_client.get("/library")
    assert lib.status_code == 200
    existing = next((item for item in lib.json() if item["game"]["id"] == game_id), None)
    if existing:
        del_resp = auth_client.delete(f"/library/{existing['id']}")
        assert del_resp.status_code == 200, f"cleanup delete failed: {del_resp.status_code} {del_resp.text}"

    add_resp = auth_client.post("/library", json={"game_id": game_id, "status": "quero_jogar"})
    assert add_resp.status_code == 201, f"add failed: {add_resp.status_code} {add_resp.text}"
    ug_id = add_resp.json()["id"]

    # Persists: appears in GET /library.
    lib2 = auth_client.get("/library")
    assert lib2.status_code == 200
    assert any(item["id"] == ug_id for item in lib2.json()), "added game missing from /library"

    # Duplicate add is rejected (409), matching 'Na biblioteca' UI behavior.
    dup_resp = auth_client.post("/library", json={"game_id": game_id, "status": "quero_jogar"})
    assert dup_resp.status_code == 409, f"expected 409 on duplicate, got {dup_resp.status_code} {dup_resp.text}"

    # Cleanup.
    del_resp = auth_client.delete(f"/library/{ug_id}")
    assert del_resp.status_code == 200
