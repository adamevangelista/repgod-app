from app import app as flask_app
from tests.conftest import signup


def test_signup_sets_session(client):
    resp = signup(client)
    assert resp.status_code == 201
    with client.session_transaction() as sess:
        assert sess['user_id'] == 1


def test_login_sets_session(client):
    signup(client, email='login@example.com')
    with client.session_transaction() as sess:
        sess.clear()

    resp = client.post('/api/login', json={'email': 'login@example.com', 'password': 'password123'})
    assert resp.status_code == 200
    with client.session_transaction() as sess:
        assert sess['user_id'] == resp.get_json()['user_id']


def test_protected_route_requires_session(client):
    resp = client.get('/api/weight/1')
    assert resp.status_code == 401


def test_protected_route_rejects_mismatched_user_id(client):
    signup(client, email='a@example.com')  # user_id 1, session set to 1

    other = flask_app.test_client()
    signup(other, email='b@example.com')  # user_id 2, session set to 2

    resp = other.get('/api/weight/1')
    assert resp.status_code == 403


def test_preset_update_rejects_non_owner(client):
    signup(client, email='owner@example.com')  # user_id 1
    resp = client.post('/api/presets', json={'name': 'Push Day', 'exercises': ['Bench']})
    assert resp.status_code == 201
    preset_id = client.get('/api/presets/1').get_json()[0]['id']

    other = flask_app.test_client()
    signup(other, email='intruder@example.com')  # user_id 2

    resp = other.put(f'/api/presets/{preset_id}', json={'name': 'Hacked', 'exercises': []})
    assert resp.status_code == 403

    resp = other.delete(f'/api/presets/{preset_id}')
    assert resp.status_code == 403


def test_log_workout_and_read_history_round_trip(client):
    signup(client, email='lifter@example.com')  # user_id 1

    resp = client.post('/api/log', json={
        'title': 'Push Day',
        'date': '2026-08-11',
        'sets': [{'name': 'Bench Press', 'set': 1, 'weight': 135, 'reps': 8}]
    })
    assert resp.status_code == 201

    exercises = client.get('/api/exercises/1').get_json()
    assert len(exercises) == 1
    exercise_id = exercises[0]['id']

    history = client.get(f'/api/history/1/{exercise_id}').get_json()
    assert len(history) == 1
    assert history[0]['weight'] == 135
    assert history[0]['reps'] == 8
