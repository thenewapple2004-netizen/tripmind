"""Small builders shared by the customer-management tests."""

API = "/api/v1"


def make_customer(client, headers, name="Amina Rahman", **overrides):
    body = {"name": name, "email": f"{name.split()[0].lower()}@example.com", "phone": "+92 300 1234567", **overrides}
    response = client.post(f"{API}/customers", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def make_inquiry(client, headers, customer_id, destination="Hunza Valley", **overrides):
    body = {"customer_id": customer_id, "destination": destination, "travelers": 2, **overrides}
    response = client.post(f"{API}/inquiries", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def move(client, headers, inquiry_id, stage, reason=None):
    body = {"stage": stage, **({"reason": reason} if reason else {})}
    return client.post(f"{API}/inquiries/{inquiry_id}/stage", json=body, headers=headers)


def confirm(client, headers, inquiry_id):
    """Walks an inquiry from New to Confirmed along the allowed path."""
    for stage in ("contacted", "planning", "quoted", "confirmed"):
        assert move(client, headers, inquiry_id, stage).status_code == 200


def conversion_body(**overrides):
    body = {
        "title": "Amina's Hunza trip",
        "destination": "Hunza Valley",
        "start_date": "2027-06-01",
        "end_date": "2027-06-08",
        "budget": 4500,
        "confirm": True,
    }
    return {**body, **overrides}
