import sqlite3
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='public')
DATABASE_FILE = 'liftlogic.db'
CORS(app)

def setup_database():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL
    );
    """)
    cursor.execute("INSERT OR IGNORE INTO users (user_id, username) VALUES (1, 'Taylor');")
    cursor.execute("INSERT OR IGNORE INTO users (user_id, username) VALUES (2, 'Adam');")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS workouts (
        workout_id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        workout_date TEXT NOT NULL,
        title TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exercises (
        exercise_id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        exercise_name TEXT NOT NULL,
        UNIQUE(user_id, exercise_name)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sets (
        set_id INTEGER PRIMARY KEY,
        workout_id INTEGER NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(exercise_id),
        set_number INTEGER NOT NULL,
        weight REAL NOT NULL,
        reps INTEGER NOT NULL
    );
    """)

    try:
        conn.commit()
        print("Database tables checked/created successfully.")
    except sqlite3.Error as e:
        print(f"An error occurred during table creation: {e}")
    finally:
        conn.close()

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/history')
def serve_history():
    return send_from_directory(app.static_folder, 'history.html')

@app.route('/login')
def serve_login():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/select')
def serve_select():
    return send_from_directory(app.static_folder, 'select.html')

@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/log', methods=['POST'])
def log_workout():
    data = request.json
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"error": "No user ID provided"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO workouts (user_id, title, workout_date) VALUES (?, ?, ?)",
            (user_id, data['title'], data['date'])
        )
        new_workout_id = cursor.lastrowid

        for s in data['sets']:
            cursor.execute(
                "SELECT exercise_id FROM exercises WHERE exercise_name = ? AND user_id = ?",
                (s['name'], user_id)
            )
            exercise = cursor.fetchone()

            if exercise:
                exercise_id = exercise['exercise_id']
            else:
                cursor.execute(
                    "INSERT INTO exercises (user_id, exercise_name) VALUES (?, ?)",
                    (user_id, s['name'])
                )
                exercise_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO sets (workout_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?, ?)",
                (new_workout_id, exercise_id, s['set'], s['weight'], s['reps'])
            )

        conn.commit()
        return jsonify({"message": "Workout logged successfully!", "workout_id": new_workout_id}), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/exercises/<int:user_id>', methods=['GET'])
def get_all_exercises(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT exercise_id, exercise_name FROM exercises WHERE user_id = ? ORDER BY exercise_name ASC",
            (user_id,)
        )
        exercises = [{"id": row['exercise_id'], "name": row['exercise_name']} for row in cursor.fetchall()]
        return jsonify(exercises), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/history/<int:user_id>/<int:exercise_id>', methods=['GET'])
def get_exercise_history(user_id, exercise_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM exercises WHERE exercise_id = ? AND user_id = ?", (exercise_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Access denied"}), 403

        cursor.execute(
            """
            SELECT w.workout_date, s.set_number, s.weight, s.reps
            FROM sets s
            JOIN workouts w ON s.workout_id = w.workout_id
            WHERE w.user_id = ? AND s.exercise_id = ?
            ORDER BY w.workout_date ASC
            """,
            (user_id, exercise_id)
        )

        history = [dict(row) for row in cursor.fetchall()]
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/exercise/<int:user_id>/<int:exercise_id>', methods=['PUT'])
def rename_exercise(user_id, exercise_id):
    data = request.json
    new_name = data.get('name')
    if not new_name:
        return jsonify({"error": "New name required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE exercises SET exercise_name = ? WHERE exercise_id = ? AND user_id = ?",
            (new_name, exercise_id, user_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Exercise not found or access denied"}), 404
        return jsonify({"message": "Exercise renamed"}), 200
    except sqlite3.IntegrityError:
        return jsonify({"error": "This exercise name already exists."}), 409
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/exercise/<int:user_id>/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(user_id, exercise_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM exercises WHERE exercise_id = ? AND user_id = ?", (exercise_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Access denied"}), 403

        cursor.execute("DELETE FROM sets WHERE exercise_id = ?", (exercise_id,))
        cursor.execute("DELETE FROM exercises WHERE exercise_id = ?", (exercise_id,))

        conn.commit()
        return jsonify({"message": "Exercise and all related sets deleted"}), 200
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

if __name__ == '__main__':
    setup_database()
    app.run(debug=True, port=5000)