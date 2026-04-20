from __future__ import annotations

from fastapi.testclient import TestClient


def _register(client: TestClient, email: str, role: str) -> dict:
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "full_name": email.split("@")[0],
            "password": "pw123456",
            "role": role,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_healthcheck(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_auth_flow_and_roles(client: TestClient) -> None:
    citizen = _register(client, "c1@example.com", "citizen")
    assert citizen["user"]["role"] == "citizen"

    # login works
    res = client.post(
        "/api/auth/login",
        json={"email": "c1@example.com", "password": "pw123456"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]

    # /me
    me = client.get("/api/auth/me", headers=_auth(token)).json()
    assert me["email"] == "c1@example.com"

    # bad login
    bad = client.post(
        "/api/auth/login",
        json={"email": "c1@example.com", "password": "nope"},
    )
    assert bad.status_code == 401


def test_ticket_bot_then_escalation(client: TestClient) -> None:
    citizen = _register(client, "c2@example.com", "citizen")
    agent = _register(client, "a1@example.com", "agent")
    token_c = citizen["access_token"]
    token_a = agent["access_token"]

    # agent goes online
    client.patch(
        "/api/users/me/status",
        json={"is_online": True},
        headers=_auth(token_a),
    )

    # citizen opens a normal ticket — handled by bot first
    res = client.post(
        "/api/tickets",
        json={
            "subject": "How do I pay my bill?",
            "description": "Need to pay my water bill",
            "priority": "normal",
        },
        headers=_auth(token_c),
    )
    assert res.status_code == 201, res.text
    ticket = res.json()
    assert ticket["status"] == "open"

    msgs = client.get(
        f"/api/tickets/{ticket['id']}/messages", headers=_auth(token_c)
    ).json()
    assert any(m["sender_kind"] == "bot" for m in msgs)

    # ask for escalation -> should reassign to the online agent
    client.post(
        f"/api/tickets/{ticket['id']}/messages",
        json={"body": "escalate"},
        headers=_auth(token_c),
    )
    ticket_after = client.get(
        f"/api/tickets/{ticket['id']}", headers=_auth(token_c)
    ).json()
    assert ticket_after["status"] == "in_progress"
    assert ticket_after["agent"]["email"] == "a1@example.com"


def test_sos_goes_straight_to_agent(client: TestClient) -> None:
    citizen = _register(client, "c3@example.com", "citizen")
    agent = _register(client, "a2@example.com", "agent")
    token_c = citizen["access_token"]
    token_a = agent["access_token"]

    client.patch(
        "/api/users/me/status",
        json={"is_online": True},
        headers=_auth(token_a),
    )

    res = client.post(
        "/api/tickets",
        json={
            "subject": "SOS",
            "description": "Emergency!",
            "priority": "sos",
        },
        headers=_auth(token_c),
    )
    assert res.status_code == 201
    ticket = res.json()
    assert ticket["status"] == "in_progress"
    assert ticket["agent"]["email"] == "a2@example.com"


def test_sos_with_no_agents_queues(client: TestClient) -> None:
    citizen = _register(client, "c4@example.com", "citizen")
    token_c = citizen["access_token"]

    res = client.post(
        "/api/tickets",
        json={
            "subject": "SOS",
            "description": "Emergency with no agents online",
            "priority": "sos",
        },
        headers=_auth(token_c),
    )
    assert res.status_code == 201
    ticket = res.json()
    assert ticket["status"] == "queued"
    assert ticket["agent"] is None


def test_admin_stats(client: TestClient) -> None:
    admin = _register(client, "admin1@example.com", "admin")
    token = admin["access_token"]
    stats = client.get("/api/admin/stats", headers=_auth(token)).json()
    assert "users" in stats
    assert "tickets" in stats
