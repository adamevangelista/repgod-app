import os

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'test-secret-key'

import pytest

from app import app as flask_app, db


@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    with flask_app.app_context():
        db.create_all()
        yield flask_app.test_client()
        db.session.remove()
        db.drop_all()


def signup(client, email='user@example.com', password='password123', first_name='Adam'):
    return client.post('/api/signup', json={
        'email': email,
        'password': password,
        'first_name': first_name,
        'last_name': 'Test',
        'height': '70'
    })
