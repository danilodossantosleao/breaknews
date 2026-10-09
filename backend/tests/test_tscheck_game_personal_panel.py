"""Criterio: Pagina do jogo salva dados pessoais (status, nota, notas, tags) e persiste."""


def test_personal_panel_save_persists(auth_client):
    search = auth_client.get("/games/search", params={"q": "Stardew", "limit": 5})
    assert search.status_code == 200
    games = search.json()
    assert games, "expected at least one game result for 'Stardew'"
    game_id = games[0]["id"]

    lib = auth_client.get("/library")
    existing = next((item for item in lib.json() if item["game"]["id"] == game_id), None)
    if existing:
        auth_client.delete(f"/library/{existing['id']}")

    add_resp = auth_client.post("/library", json={"game_id": game_id, "status": "quero_jogar"})
    assert add_resp.status_code == 201, f"add failed: {add_resp.status_code} {add_resp.text}"
    ug_id = add_resp.json()["id"]

    payload = {
        "status": "jogando",
        "personal_rating": 8.5,
        "personal_notes": "tscheck-personal-panel nota de teste",
        "tags": ["tscheck-tag-a", "tscheck-tag-b"],
        "is_favorite": True,
    }
    patch_resp = auth_client.patch(f"/library/{ug_id}", json=payload)
    assert patch_resp.status_code == 200, f"patch failed: {patch_resp.status_code} {patch_resp.text}"
    body = patch_resp.json()
    assert body["status"] == "jogando"
    assert body["personal_rating"] == 8.5
    assert body["personal_notes"] == payload["personal_notes"]
    assert sorted(body["tags"]) == sorted(payload["tags"])
    assert body["is_favorite"] is True

    # Persists across a fresh GET /library (simulates page reload).
    lib2 = auth_client.get("/library")
    item = next(i for i in lib2.json() if i["id"] == ug_id)
    assert item["personal_notes"] == payload["personal_notes"]
    assert item["personal_rating"] == 8.5
    assert sorted(item["tags"]) == sorted(payload["tags"])

    auth_client.delete(f"/library/{ug_id}")
