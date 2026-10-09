"""Criterio: Estado de leitura e salvamento de noticias persiste e aparece em /saved."""


def test_news_read_and_save_state_persists(auth_client):
    news_list = auth_client.get("/news", params={"page_size": 1})
    assert news_list.status_code == 200, f"list news failed: {news_list.status_code} {news_list.text}"
    items = news_list.json()["items"]
    assert items, "expected at least one news item"
    news_id = items[0]["id"]

    # Toggle read -> true.
    resp = auth_client.post(f"/news/{news_id}/state", json={"is_read": True})
    assert resp.status_code == 200, f"state read failed: {resp.status_code} {resp.text}"
    assert resp.json()["read"] is True

    # Toggle saved -> true.
    resp2 = auth_client.post(f"/news/{news_id}/state", json={"is_saved": True})
    assert resp2.status_code == 200, f"state save failed: {resp2.status_code} {resp2.text}"
    assert resp2.json()["saved"] is True

    # Appears in /saved under news.
    saved = auth_client.get("/saved")
    assert saved.status_code == 200, f"get saved failed: {saved.status_code} {saved.text}"
    saved_news_ids = [entry["news"]["id"] for entry in saved.json().get("news", []) if entry.get("news")]
    assert news_id in saved_news_ids, "saved news item not present in /saved response"

    # Detail reflects persisted state.
    detail = auth_client.get(f"/news/{news_id}")
    assert detail.status_code == 200
    assert detail.json()["read"] is True
    assert detail.json()["saved"] is True

    # Cleanup: unsave/unread so repeated runs stay isolated to this item only.
    auth_client.post(f"/news/{news_id}/state", json={"is_saved": False, "is_read": False})
