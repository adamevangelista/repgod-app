import sqlite3
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json
from flask_migrate import Migrate

app = Flask(__name__, static_folder='public')
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or 'sqlite:///liftlogic.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
migrate = Migrate(app, db)

class Users(db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    height = db.Column(db.String(20), nullable=True)
    weights = db.relationship('BodyWeight', backref='user', lazy=True)
    presets = db.relationship('Presets', backref='user', lazy=True)

class BodyWeight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(10), nullable=False)

class Presets(db.Model):
    preset_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    preset_name = db.Column(db.String(100), nullable=False)
    exercises_json = db.Column(db.Text, nullable=False)

class Workouts(db.Model):
    workout_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    workout_date = db.Column(db.String(10), nullable=False)
    title = db.Column(db.String(100), nullable=False)

class Exercises(db.Model):
    exercise_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    exercise_name = db.Column(db.String(100), nullable=False)
    __table_args__ = (db.UniqueConstraint('user_id', 'exercise_name'),)

class Sets(db.Model):
    set_id = db.Column(db.Integer, primary_key=True)
    workout_id = db.Column(db.Integer, db.ForeignKey('workouts.workout_id', ondelete='CASCADE'), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.exercise_id'), nullable=False)
    set_number = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Float, nullable=False)
    reps = db.Column(db.Integer, nullable=False)

def setup_database():
    with app.app_context():
        db.create_all()

@app.route('/')
def serve_home(): return send_from_directory(app.static_folder, 'dashboard.html')
@app.route('/log')
def serve_log_page(): return send_from_directory(app.static_folder, 'index.html')
@app.route('/history')
def serve_history(): return send_from_directory(app.static_folder, 'history.html')
@app.route('/login')
def serve_login(): return send_from_directory(app.static_folder, 'login.html')
@app.route('/signup')
def serve_signup(): return send_from_directory(app.static_folder, 'signup.html')
@app.route('/dashboard')
def serve_dashboard(): return send_from_directory(app.static_folder, 'dashboard.html')
@app.route('/<path:path>')
def serve_static_files(path): return send_from_directory(app.static_folder, path)

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    try:
        hashed_password = generate_password_hash(data['password'])
        new_user = Users(
            email=data['email'], password_hash=hashed_password,
            first_name=data['first_name'], last_name=data['last_name'],
            height=data['height']
        )
        db.session.add(new_user)
        db.session.commit()
        if data.get('weight'):
            db.session.add(BodyWeight(user_id=new_user.user_id, weight=float(data['weight']), date=datetime.now().strftime('%Y-%m-%d')))
            db.session.commit()
        return jsonify({"message": "User created"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Users.query.filter_by(email=data['email']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        return jsonify({"user_id": user.user_id, "first_name": user.first_name, "email": user.email}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/presets/<int:user_id>', methods=['GET'])
def get_presets(user_id):
    presets = Presets.query.filter_by(user_id=user_id).all()
    output = [{"id": p.preset_id, "name": p.preset_name, "exercises": json.loads(p.exercises_json)} for p in presets]
    return jsonify(output), 200

@app.route('/api/presets', methods=['POST'])
def create_preset():
    data = request.json
    try:
        exercises_str = json.dumps(data['exercises'])
        new_preset = Presets(user_id=data['user_id'], preset_name=data['name'], exercises_json=exercises_str)
        db.session.add(new_preset)
        db.session.commit()
        return jsonify({"message": "Preset created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/presets/<int:preset_id>', methods=['PUT'])
def update_preset(preset_id):
    data = request.json
    try:
        preset = Presets.query.get(preset_id)
        if not preset: return jsonify({"error": "Not found"}), 404
        preset.preset_name = data['name']
        preset.exercises_json = json.dumps(data['exercises'])
        db.session.commit()
        return jsonify({"message": "Updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/presets/<int:preset_id>', methods=['DELETE'])
def delete_preset(preset_id):
    try:
        preset = Presets.query.get(preset_id)
        if preset:
            db.session.delete(preset)
            db.session.commit()
            return jsonify({"message": "Deleted"}), 200
        return jsonify({"error": "Not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/weight/<int:user_id>', methods=['GET'])
def get_weight_history(user_id):
    weights = BodyWeight.query.filter_by(user_id=user_id).order_by(BodyWeight.date.desc()).limit(10).all()
    return jsonify([{"date": w.date, "weight": w.weight} for w in weights]), 200

@app.route('/api/weight', methods=['POST'])
def log_weight():
    data = request.json
    try:
        db.session.add(BodyWeight(user_id=data['user_id'], weight=float(data['weight']), date=data.get('date', datetime.now().strftime('%Y-%m-%d'))))
        db.session.commit()
        return jsonify({"message": "Logged"}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/log', methods=['POST'])
def log_workout():
    data = request.json
    try:
        new_workout = Workouts(user_id=data['user_id'], title=data['title'], workout_date=data['date'])
        db.session.add(new_workout)
        db.session.commit()
        for s in data['sets']:
            ex = Exercises.query.filter_by(exercise_name=s['name'], user_id=data['user_id']).first()
            if not ex:
                ex = Exercises(user_id=data['user_id'], exercise_name=s['name'])
                db.session.add(ex)
                db.session.commit()
            db.session.add(Sets(workout_id=new_workout.workout_id, exercise_id=ex.exercise_id, set_number=s['set'], weight=s['weight'], reps=s['reps']))
        db.session.commit()
        return jsonify({"message": "Saved"}), 201
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/sets', methods=['POST'])
def add_set_manually():
    data = request.json
    user_id = data.get('user_id')
    exercise_id = data.get('exercise_id')
    date = data.get('date')
    weight = data.get('weight')
    reps = data.get('reps')

    try:
        workout = Workouts.query.filter_by(user_id=user_id, workout_date=date).first()
        if not workout:
            workout = Workouts(user_id=user_id, workout_date=date, title="Manual Log")
            db.session.add(workout)
            db.session.commit()

        existing_sets = Sets.query.filter_by(workout_id=workout.workout_id, exercise_id=exercise_id).count()
        next_set_num = existing_sets + 1

        new_set = Sets(
            workout_id=workout.workout_id,
            exercise_id=exercise_id,
            set_number=next_set_num,
            weight=weight,
            reps=reps
        )
        db.session.add(new_set)
        db.session.commit()
        return jsonify({"message": "Set added"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/exercises/<int:user_id>', methods=['GET'])
def get_all_exercises(user_id):
    exercises = Exercises.query.filter_by(user_id=user_id).order_by(Exercises.exercise_name.asc()).all()
    return jsonify([{"id": ex.exercise_id, "name": ex.exercise_name} for ex in exercises]), 200

@app.route('/api/history/<int:user_id>/<int:exercise_id>', methods=['GET'])
def get_history(user_id, exercise_id):
    history = db.session.query(Workouts.workout_date, Sets.set_number, Sets.weight, Sets.reps).join(Sets).filter(Workouts.user_id==user_id, Sets.exercise_id==exercise_id).order_by(Workouts.workout_date.asc()).all()
    return jsonify([{"workout_date": h.workout_date, "set_number": h.set_number, "weight": h.weight, "reps": h.reps} for h in history]), 200

@app.route('/api/workout-dates/<int:user_id>', methods=['GET'])
def get_dates(user_id):
    dates = db.session.query(Workouts.workout_date).filter_by(user_id=user_id).distinct().all()
    return jsonify([d.workout_date for d in dates]), 200

@app.route('/api/last-performance/<int:user_id>/<string:exercise_name>', methods=['GET'])
def get_last_perf(user_id, exercise_name):
    ex = Exercises.query.filter_by(exercise_name=exercise_name, user_id=user_id).first()
    if not ex: return jsonify({"message": "No data"}), 404
    last_w = Workouts.query.join(Sets).filter(Workouts.user_id==user_id, Sets.exercise_id==ex.exercise_id).order_by(Workouts.workout_date.desc()).first()
    if not last_w: return jsonify({"message": "No data"}), 404
    sets = Sets.query.filter_by(workout_id=last_w.workout_id, exercise_id=ex.exercise_id).order_by(Sets.set_number.asc()).all()
    best_set = max(sets, key=lambda s: (s.weight, s.reps))
    suggestion = best_set.weight + (5 if best_set.reps >= 8 else 2.5 if best_set.reps >= 5 else 0)
    return jsonify({"date": last_w.workout_date, "sets": [{"weight": s.weight, "reps": s.reps} for s in sets], "suggestion": suggestion}), 200

@app.route('/api/exercise/<int:user_id>/<int:exercise_id>', methods=['PUT'])
def rename_exercise(user_id, exercise_id):
    data = request.json
    new_name = data.get('name')
    force_merge = data.get('force_merge', False)

    try:
        existing_target = Exercises.query.filter_by(exercise_name=new_name, user_id=user_id).first()

        if existing_target:
            if not force_merge:
                return jsonify({"error": "Merge needed", "target_id": existing_target.exercise_id}), 409

            sets_to_move = Sets.query.filter_by(exercise_id=exercise_id).all()
            for s in sets_to_move:
                s.exercise_id = existing_target.exercise_id

            old_exercise = Exercises.query.get(exercise_id)
            db.session.delete(old_exercise)
            db.session.commit()
            return jsonify({"message": f"Merged into {new_name}"}), 200

        exercise = Exercises.query.filter_by(exercise_id=exercise_id, user_id=user_id).first()
        if not exercise: return jsonify({"error": "Exercise not found"}), 404
        exercise.exercise_name = new_name
        db.session.commit()
        return jsonify({"message": "Exercise renamed"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/exercise/<int:user_id>/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(user_id, exercise_id):
    try:
        exercise = Exercises.query.filter_by(exercise_id=exercise_id, user_id=user_id).first()
        if not exercise: return jsonify({"error": "Access denied"}), 403
        sets = Sets.query.filter_by(exercise_id=exercise_id).all()
        for s in sets: db.session.delete(s)
        db.session.delete(exercise)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    setup_database()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)