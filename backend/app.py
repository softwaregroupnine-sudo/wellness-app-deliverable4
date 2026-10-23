
import os
import sys
import time
import uuid
import json
import html
import hashlib
import smtplib
import sqlite3
from email.message import EmailMessage
from datetime import date, timedelta
from pathlib import Path

from flask import Flask, jsonify, request, Response
from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired,
)
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(REPO_ROOT / "database"))

from db import init_db, get_connection
from ai_service import (
    analyze_assessment,
    answer_wellness_question,
    analyze_wellness_history,
)

load_dotenv(REPO_ROOT / ".env")

app = Flask(__name__)
CORS(app)

# Create/update database tables when the API starts.
init_db()


# --------------------------------------------------
# Helper functions
# --------------------------------------------------

def get_request_data():
    """Return JSON request data, or an empty dictionary."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _get_user(cur, participant_id):
    """Find a user using their participant ID."""
    if not isinstance(participant_id, str) or not participant_id.strip():
        return None

    row = cur.execute(
        "SELECT id FROM users WHERE participant_id = ?",
        (participant_id.strip(),)
    ).fetchone()

    return row["id"] if row else None


def _decode_checkin(row):
    """Convert a database check-in row into a JSON-friendly dictionary."""
    result = dict(row)

    try:
        result["feelings"] = json.loads(result.get("feelings") or "[]")
    except (json.JSONDecodeError, TypeError):
        result["feelings"] = []

    return result


def _valid_date(value):
    """Check whether a value is a valid YYYY-MM-DD date."""
    if not isinstance(value, str):
        return False

    try:
        date.fromisoformat(value)
        return len(value) == 10
    except ValueError:
        return False


# --------------------------------------------------
# Home
# --------------------------------------------------

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "ok",
        "message": "Wellness Support API is running"
    }), 200


@app.route("/home", methods=["GET"])
def home():
    return jsonify({"status": "ok"}), 200


# --------------------------------------------------
# Authentication
# --------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    data = get_request_data()

    email = data.get("email")
    password = data.get("password")
    display_name = data.get("display_name")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "A valid email is required"}), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters"
        }), 400

    if display_name is not None and not isinstance(display_name, str):
        return jsonify({"error": "display_name must be text"}), 400

    email = email.strip().lower()
    display_name = display_name.strip() if display_name else None

    conn = get_connection()

    try:
        participant_id = str(uuid.uuid4())
        password_hash = generate_password_hash(password)

        cur = conn.execute(
            """
            INSERT INTO users
                (participant_id, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
            """,
            (participant_id, email, password_hash, display_name)
        )

        conn.commit()

        return jsonify({
            "id": cur.lastrowid,
            "participant_id": participant_id,
            "email": email,
            "display_name": display_name
        }), 201

    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({
            "error": "An account with this email already exists"
        }), 409

    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data = get_request_data()

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Email is required"}), 400

    if not isinstance(password, str) or not password:
        return jsonify({"error": "Password is required"}), 400

    conn = get_connection()

    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),)
        ).fetchone()

        if (
            row is None
            or not row["password_hash"]
            or not check_password_hash(row["password_hash"], password)
        ):
            return jsonify({"error": "Invalid email or password"}), 401

        return jsonify({
            "id": row["id"],
            "participant_id": row["participant_id"],
            "email": row["email"],
            "display_name": row["display_name"]
        }), 200

    finally:
        conn.close()


# --------------------------------------------------
# Password reset (email link)
# --------------------------------------------------
# Flow: the app calls POST /forgot-password with an email address.
# If the account exists, an email with a link is sent. The link opens
# a small web page served by this API where the user chooses a new
# password. No extra database table is needed: the link is a signed,
# time-limited token that stops working once the password changes.

RESET_TOKEN_MAX_AGE = 30 * 60  # 30 minutes


def _reset_serializer():
    secret = os.getenv("SECRET_KEY") or "dev-only-change-me"
    return URLSafeTimedSerializer(secret, salt="password-reset")


def _password_fingerprint(password_hash):
    return hashlib.sha256(
        (password_hash or "").encode("utf-8")
    ).hexdigest()[:16]


def _make_reset_token(user_row):
    return _reset_serializer().dumps({
        "uid": user_row["id"],
        "fp": _password_fingerprint(user_row["password_hash"]),
    })


def _read_reset_token(token):
    """Return the user row for a valid token, otherwise None."""
    try:
        payload = _reset_serializer().loads(
            token, max_age=RESET_TOKEN_MAX_AGE
        )
    except (BadSignature, SignatureExpired):
        return None

    conn = get_connection()

    try:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE id = ?",
            (payload.get("uid"),)
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        return None

    if payload.get("fp") != _password_fingerprint(row["password_hash"]):
        return None  # password already changed, link is used up

    return row


def _send_reset_email(to_address, reset_link):
    """Send the reset email, or print the link if SMTP is not set up."""
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")

    if not (host and user and password):
        # Development mode: no email server configured.
        app.logger.warning(
            "SMTP is not configured. Password reset link for %s: %s",
            to_address,
            reset_link
        )
        return

    message = EmailMessage()
    message["Subject"] = "Reset your Wellness App password"
    message["From"] = os.getenv("SMTP_FROM") or user
    message["To"] = to_address
    message.set_content(
        "Hi,\n\n"
        "We received a request to reset your password. "
        "Open this link to choose a new one (valid for 30 minutes):\n\n"
        f"{reset_link}\n\n"
        "If you did not ask for this, you can ignore this email "
        "and your password will stay the same."
    )

    port = int(os.getenv("SMTP_PORT") or 587)

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(message)


def _reset_page(title, body_html):
    page = f"""<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  body {{ margin:0; font-family: -apple-system, Segoe UI, Roboto, sans-serif;
         background:#F4EFE8; color:#304F4A; }}
  .card {{ max-width:380px; margin:48px auto; background:#fff;
          border-radius:20px; padding:26px; border:1px solid #ECEDE6; }}
  h1 {{ font-size:22px; margin:0 0 8px; }}
  p {{ font-size:14px; line-height:1.5; color:#52635D; }}
  label {{ display:block; font-size:13px; font-weight:600; margin-top:14px; }}
  input {{ width:100%; box-sizing:border-box; padding:12px; margin-top:6px;
          border:1px solid #C9D3CB; border-radius:12px; font-size:15px; }}
  button {{ width:100%; margin-top:20px; padding:13px; border:0;
           border-radius:12px; background:#304F4A; color:#fff;
           font-size:15px; font-weight:700; }}
  .error {{ color:#9B3B3B; }}
</style></head>
<body><div class="card">{body_html}</div></body></html>"""

    return Response(page, mimetype="text/html")


def _reset_form(token, message=""):
    note = (
        f'<p class="error">{html.escape(message)}</p>' if message else ""
    )

    return _reset_page("Reset password", f"""
<h1>Choose a new password</h1>
<p>Enter a new password for your Wellness App account.</p>
{note}
<form method="post" action="/reset-password">
  <input type="hidden" name="token" value="{html.escape(token)}">
  <label for="password">New password</label>
  <input id="password" name="password" type="password"
         minlength="8" required autocomplete="new-password">
  <label for="confirm">Confirm password</label>
  <input id="confirm" name="confirm" type="password"
         minlength="8" required autocomplete="new-password">
  <button type="submit">Save new password</button>
</form>""")


def _reset_invalid():
    return _reset_page("Link expired", """
<h1>This link has expired</h1>
<p>The reset link is no longer valid. Go back to the app and tap
<b>Forgot password?</b> to get a new one.</p>""")


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = get_request_data()
    email = data.get("email")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Email is required"}), 400

    email = email.strip().lower()

    # The same reply is always returned so the endpoint does not reveal
    # which email addresses have accounts.
    generic_reply = jsonify({
        "message": (
            "If an account exists for that email, a reset link "
            "has been sent."
        )
    })

    conn = get_connection()

    try:
        user = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (email,)
        ).fetchone()
    finally:
        conn.close()

    if user is not None:
        try:
            base_url = (
                os.getenv("PUBLIC_BASE_URL")
                or request.host_url.rstrip("/")
            )

            if "ngrok" in base_url and base_url.startswith("http://"):
                base_url = "https://" + base_url[len("http://"):]

            link = f"{base_url}/reset-password?token={_make_reset_token(user)}"
            _send_reset_email(user["email"], link)
        except Exception:
            app.logger.exception("Could not send password reset email")

    return generic_reply, 200


@app.route("/reset-password", methods=["GET"])
def reset_password_form():
    token = request.args.get("token", "")

    if _read_reset_token(token) is None:
        return _reset_invalid()

    return _reset_form(token)


@app.route("/reset-password", methods=["POST"])
def reset_password_submit():
    token = request.form.get("token", "")
    password = request.form.get("password", "")
    confirm = request.form.get("confirm", "")

    user = _read_reset_token(token)

    if user is None:
        return _reset_invalid()

    if len(password) < 8:
        return _reset_form(
            token, "Password must contain at least 8 characters."
        )

    if password != confirm:
        return _reset_form(token, "The two passwords do not match.")

    conn = get_connection()

    try:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (generate_password_hash(password), user["id"])
        )
        conn.commit()
    finally:
        conn.close()

    return _reset_page("Password updated", """
<h1>Password updated</h1>
<p>Your password has been changed. You can close this page and log in
to the app with your new password.</p>""")


# --------------------------------------------------
# Assessments
# --------------------------------------------------

@app.route("/assessments", methods=["POST"])
def create_assessment():
    data = get_request_data()

    text_input = data.get("text_input")
    participant_id = data.get("participant_id")

    if not isinstance(text_input, str) or not text_input.strip():
        return jsonify({"error": "text_input is required"}), 400

    if len(text_input) > 10000:
        return jsonify({"error": "Assessment text is too long"}), 400

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({"error": "participant_id is required"}), 400

    text_input = text_input.strip()
    start_time = time.perf_counter()

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        try:
            emotional_label, guidance_text = analyze_assessment(text_input)

            if emotional_label == "unavailable":
                raise RuntimeError("AI service unavailable")
        except Exception:
            app.logger.exception("Assessment AI request failed")
            return jsonify({
                "error": (
                    "Unable to generate guidance right now. "
                    "Please try again."
                )
            }), 502

        response_time_ms = int(
            (time.perf_counter() - start_time) * 1000
        )

        cur = conn.execute(
            """
            INSERT INTO assessments
                (user_id, text_input, emotional_label, response_time_ms)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, text_input, emotional_label, response_time_ms)
        )

        assessment_id = cur.lastrowid

        # Save the assessment's original guidance.
        # The NULL activity_key distinguishes this record from
        # recommendations saved by the wellness history analysis.
        conn.execute(
            """
            INSERT INTO interventions
                (
                    user_id,
                    assessment_id,
                    recommendation_text,
                    intervention_type
                )
            VALUES (?, ?, ?, ?)
            """,
            (
                user_id,
                assessment_id,
                guidance_text,
                "general"
            )
        )

        conn.commit()

        return jsonify({
            "id": assessment_id,
            "text_input": text_input,
            "emotional_label": emotional_label,
            "guidance": guidance_text,
            "response_time_ms": response_time_ms
        }), 201

    finally:
        conn.close()


@app.route("/assessments", methods=["GET"])
def list_assessments():
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT a.*,
                   (
                       SELECT i.recommendation_text
                       FROM interventions i
                       WHERE i.assessment_id = a.id
                         AND i.activity_key IS NULL
                       ORDER BY i.id DESC
                       LIMIT 1
                   ) AS guidance
            FROM assessments a
            JOIN users u ON a.user_id = u.id
            WHERE u.participant_id = ?
            ORDER BY a.submitted_at DESC, a.id DESC
            """,
            (participant_id,)
        ).fetchall()

        return jsonify([dict(row) for row in rows]), 200

    finally:
        conn.close()


@app.route("/assessments/<int:assessment_id>", methods=["GET"])
def get_assessment(assessment_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        row = conn.execute(
            """
            SELECT a.*
            FROM assessments a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND u.participant_id = ?
            """,
            (assessment_id, participant_id)
        ).fetchone()

        if row is None:
            return jsonify({"error": "Assessment not found"}), 404

        return jsonify(dict(row)), 200

    finally:
        conn.close()


@app.route("/assessments/<int:assessment_id>", methods=["PUT"])
def update_assessment(assessment_id):
    data = get_request_data()

    text_input = data.get("text_input")
    participant_id = data.get("participant_id")

    if not isinstance(text_input, str) or not text_input.strip():
        return jsonify({"error": "text_input is required"}), 400

    text_input = text_input.strip()

    if len(text_input) > 10000:
        return jsonify({"error": "Assessment text is too long"}), 400

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        existing = conn.execute(
            "SELECT id FROM assessments WHERE id = ? AND user_id = ?",
            (assessment_id, user_id)
        ).fetchone()

        if existing is None:
            return jsonify({"error": "Assessment not found"}), 404

        # Re-run the AI so the label and guidance match the new text.
        try:
            emotional_label, guidance_text = analyze_assessment(text_input)

            if emotional_label == "unavailable":
                raise RuntimeError("AI service unavailable")
        except Exception:
            app.logger.exception("Assessment AI update failed")
            return jsonify({
                "error": (
                    "Unable to update your guidance right now. "
                    "Please try again."
                )
            }), 502

        conn.execute(
            """
            UPDATE assessments
            SET text_input = ?, emotional_label = ?
            WHERE id = ? AND user_id = ?
            """,
            (text_input, emotional_label, assessment_id, user_id)
        )

        cur = conn.execute(
            """
            UPDATE interventions
            SET recommendation_text = ?
            WHERE assessment_id = ?
              AND user_id = ?
              AND activity_key IS NULL
            """,
            (guidance_text, assessment_id, user_id)
        )

        if cur.rowcount == 0:
            conn.execute(
                """
                INSERT INTO interventions
                    (user_id, assessment_id, recommendation_text,
                     intervention_type)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, assessment_id, guidance_text, "general")
            )

        conn.commit()

        return jsonify({
            "id": assessment_id,
            "text_input": text_input,
            "emotional_label": emotional_label,
            "guidance": guidance_text
        }), 200

    finally:
        conn.close()


@app.route("/assessments/<int:assessment_id>", methods=["DELETE"])
def delete_assessment(assessment_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            SELECT a.id
            FROM assessments a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = ? AND u.participant_id = ?
            """,
            (assessment_id, participant_id)
        )

        if cur.fetchone() is None:
            return jsonify({"error": "Assessment not found"}), 404

        # Keep the AI wellness recommendations (activity_key set);
        # only detach them from this assessment.
        conn.execute(
            """
            UPDATE interventions
            SET assessment_id = NULL
            WHERE assessment_id = ? AND activity_key IS NOT NULL
            """,
            (assessment_id,)
        )

        conn.execute(
            "DELETE FROM interventions WHERE assessment_id = ?",
            (assessment_id,)
        )
        conn.execute(
            "DELETE FROM assessments WHERE id = ?",
            (assessment_id,)
        )

        conn.commit()

        return jsonify({"deleted": assessment_id}), 200

    finally:
        conn.close()


# --------------------------------------------------
# Interventions
# --------------------------------------------------

@app.route("/interventions/<int:assessment_id>", methods=["GET"])
def get_intervention(assessment_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        row = conn.execute(
            """
            SELECT i.*
            FROM interventions i
            JOIN assessments a ON i.assessment_id = a.id
            JOIN users u ON a.user_id = u.id
            WHERE i.assessment_id = ? AND u.participant_id = ?
            ORDER BY i.created_at DESC, i.id DESC
            LIMIT 1
            """,
            (assessment_id, participant_id)
        ).fetchone()

        if row is None:
            return jsonify({"error": "Intervention not found"}), 404

        return jsonify(dict(row)), 200

    finally:
        conn.close()


@app.route("/interventions/<int:intervention_id>", methods=["PUT"])
def update_intervention(intervention_id):
    data = get_request_data()

    participant_id = data.get("participant_id")
    recommendation_text = data.get("recommendation_text")

    if (
        not participant_id
        or not isinstance(recommendation_text, str)
        or not recommendation_text.strip()
    ):
        return jsonify({
            "error": (
                "participant_id and recommendation_text are required"
            )
        }), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            UPDATE interventions
            SET recommendation_text = ?
            WHERE id = ?
              AND assessment_id IN (
                  SELECT a.id
                  FROM assessments a
                  JOIN users u ON a.user_id = u.id
                  WHERE u.participant_id = ?
              )
            """,
            (recommendation_text.strip(), intervention_id, participant_id)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Intervention not found"}), 404

        conn.commit()

        return jsonify({
            "id": intervention_id,
            "recommendation_text": recommendation_text.strip()
        }), 200

    finally:
        conn.close()


@app.route("/interventions/<int:intervention_id>", methods=["DELETE"])
def delete_intervention(intervention_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            DELETE FROM interventions
            WHERE id = ?
              AND assessment_id IN (
                  SELECT a.id
                  FROM assessments a
                  JOIN users u ON a.user_id = u.id
                  WHERE u.participant_id = ?
              )
            """,
            (intervention_id, participant_id)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Intervention not found"}), 404

        conn.commit()

        return jsonify({"deleted": intervention_id}), 200

    finally:
        conn.close()


# --------------------------------------------------
# Mood check-ins
# --------------------------------------------------

# GET saved check-ins for a participant
@app.route("/checkins", methods=["GET"])
def get_checkins():
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        user_id = _get_user(
            conn.cursor(),
            participant_id
        )

        if user_id is None:
            return jsonify({
                "error": "Participant not found"
            }), 404

        rows = conn.execute(
            """
            SELECT *
            FROM checkins
            WHERE user_id = ?
            ORDER BY checkin_date DESC, id DESC
            """,
            (user_id,)
        ).fetchall()

        checkins = [
            _decode_checkin(row)
            for row in rows
        ]

        return jsonify(checkins), 200

    finally:
        conn.close()


# CREATE a new mood check-in
@app.route("/checkins", methods=["POST"])
def create_checkin():
    data = get_request_data()

    participant_id = data.get("participant_id")
    mood_value = data.get("mood_value")
    feelings = data.get("feelings", [])
    note = data.get("note", "")
    checkin_date = data.get("checkin_date")

    # Optional check-in fields
    stress_level = data.get("stress_level")
    sleep_quality = data.get("sleep_quality")
    main_concern = data.get("main_concern")

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({
            "error": "participant_id is required"
        }), 400

    participant_id = participant_id.strip()

    if (
        not isinstance(mood_value, (str, int, float))
        or isinstance(mood_value, bool)
    ):
        return jsonify({
            "error": "A valid mood_value is required"
        }), 400

    mood_value = str(mood_value).strip()

    if not mood_value:
        return jsonify({
            "error": "mood_value cannot be empty"
        }), 400

    if not isinstance(feelings, list) or not all(
        isinstance(feeling, str) and feeling.strip()
        for feeling in feelings
    ):
        return jsonify({
            "error": "feelings must be a list of non-empty strings"
        }), 400

    feelings = list(dict.fromkeys(
        feeling.strip() for feeling in feelings
    ))

    if not isinstance(note, str):
        return jsonify({
            "error": "note must be text"
        }), 400

    note = note.strip()

    if len(note) > 5000:
        return jsonify({
            "error": "The note is too long"
        }), 400

    # Validate optional stress level
    allowed_stress_levels = {"Low", "Moderate", "High"}

    if stress_level == "":
        stress_level = None

    if stress_level is not None:
        if not isinstance(stress_level, str):
            return jsonify({
                "error": "stress_level must be text or empty"
            }), 400

        stress_level = stress_level.strip()

        if not stress_level:
            stress_level = None
        elif stress_level not in allowed_stress_levels:
            return jsonify({
                "error": (
                    "stress_level must be Low, Moderate, or High"
                )
            }), 400

    # Validate optional sleep quality
    allowed_sleep_qualities = {"Poor", "Fair", "Good"}

    if sleep_quality == "":
        sleep_quality = None

    if sleep_quality is not None:
        if not isinstance(sleep_quality, str):
            return jsonify({
                "error": "sleep_quality must be text or empty"
            }), 400

        sleep_quality = sleep_quality.strip()

        if not sleep_quality:
            sleep_quality = None
        elif sleep_quality not in allowed_sleep_qualities:
            return jsonify({
                "error": "sleep_quality must be Poor, Fair, or Good"
            }), 400

    # Validate optional main concern
    allowed_main_concerns = {
        "Academic workload",
        "Personal concerns",
        "Social relationships",
        "Health and sleep",
        "No particular concern",
        "Other"
    }

    if main_concern == "":
        main_concern = None

    if main_concern is not None:
        if not isinstance(main_concern, str):
            return jsonify({
                "error": "main_concern must be text or empty"
            }), 400

        main_concern = main_concern.strip()

        if not main_concern:
            main_concern = None
        elif main_concern not in allowed_main_concerns:
            return jsonify({
                "error": "Invalid main_concern selection"
            }), 400

    if checkin_date is not None and not _valid_date(checkin_date):
        return jsonify({
            "error": "checkin_date must use YYYY-MM-DD format"
        }), 400

    conn = get_connection()

    try:
        user_id = _get_user(
            conn.cursor(),
            participant_id
        )

        if user_id is None:
            return jsonify({
                "error": "Participant not found"
            }), 404

        feelings_json = json.dumps(feelings)

        if checkin_date:
            cur = conn.execute(
                """
                INSERT INTO checkins (
                    user_id,
                    mood_value,
                    feelings,
                    note,
                    stress_level,
                    sleep_quality,
                    main_concern,
                    checkin_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    mood_value,
                    feelings_json,
                    note,
                    stress_level,
                    sleep_quality,
                    main_concern,
                    checkin_date
                )
            )
        else:
            cur = conn.execute(
                """
                INSERT INTO checkins (
                    user_id,
                    mood_value,
                    feelings,
                    note,
                    stress_level,
                    sleep_quality,
                    main_concern
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    mood_value,
                    feelings_json,
                    note,
                    stress_level,
                    sleep_quality,
                    main_concern
                )
            )

        conn.commit()

        checkin_id = cur.lastrowid

        saved_row = conn.execute(
            """
            SELECT *
            FROM checkins
            WHERE id = ?
            """,
            (checkin_id,)
        ).fetchone()

        return jsonify(_decode_checkin(saved_row)), 201

    except sqlite3.IntegrityError:
        conn.rollback()

        return jsonify({
            "error": "A check-in already exists for this date"
        }), 409

    finally:
        conn.close()


# DELETE a mood check-in
@app.route("/checkins/<int:checkin_id>", methods=["DELETE"])
def delete_checkin(checkin_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            DELETE FROM checkins
            WHERE id = ?
              AND user_id = (
                  SELECT id FROM users WHERE participant_id = ?
              )
            """,
            (checkin_id, participant_id)
        )

        if cur.rowcount == 0:
            return jsonify({
                "error": "Check-in not found"
            }), 404

        conn.commit()

        return jsonify({
            "deleted": checkin_id
        }), 200

    finally:
        conn.close()


# GET current check-in streak
@app.route("/checkins/streak", methods=["GET"])
def get_streak():
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT c.checkin_date
            FROM checkins c
            JOIN users u ON c.user_id = u.id
            WHERE u.participant_id = ?
            ORDER BY c.checkin_date DESC
            """,
            (participant_id,)
        ).fetchall()

        dates = {
            date.fromisoformat(row["checkin_date"])
            for row in rows
        }

    finally:
        conn.close()

    today = date.today()
    cursor = today

    if cursor not in dates:
        cursor = today - timedelta(days=1)

    streak = 0

    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)

    return jsonify({
        "participant_id": participant_id,
        "current_streak": streak
    }), 200


# GET mood trends
@app.route("/checkins/trends", methods=["GET"])
def get_trends():
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT c.checkin_date, c.mood_value, c.feelings
            FROM checkins c
            JOIN users u ON c.user_id = u.id
            WHERE u.participant_id = ?
            ORDER BY c.checkin_date ASC
            """,
            (participant_id,)
        ).fetchall()

        results = []

        for row in rows:
            try:
                feelings = json.loads(row["feelings"] or "[]")
            except (json.JSONDecodeError, TypeError):
                feelings = []

            results.append({
                "date": row["checkin_date"],
                "mood_value": row["mood_value"],
                "feelings": feelings
            })

        return jsonify(results), 200

    finally:
        conn.close()


# --------------------------------------------------
# AI Wellness Analysis
# --------------------------------------------------

@app.route("/wellness-analysis", methods=["POST"])
def generate_wellness_analysis():
    data = get_request_data()
    participant_id = data.get("participant_id")

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({
            "error": "participant_id is required"
        }), 400

    participant_id = participant_id.strip()
    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({
                "error": "Participant not found"
            }), 404

        # Retrieve this student's recent mood check-ins.
        checkin_rows = conn.execute(
            """
            SELECT *
            FROM checkins
            WHERE user_id = ?
            ORDER BY checkin_date DESC, id DESC
            LIMIT 30
            """,
            (user_id,)
        ).fetchall()

        checkins = [
            _decode_checkin(row)
            for row in checkin_rows
        ]

        # Retrieve this student's recent AI assessment results.
        assessment_rows = conn.execute(
            """
            SELECT id, text_input, emotional_label, submitted_at
            FROM assessments
            WHERE user_id = ?
            ORDER BY submitted_at DESC, id DESC
            LIMIT 10
            """,
            (user_id,)
        ).fetchall()

        assessments = [
            dict(row)
            for row in assessment_rows
        ]

        # Generate a suitable response for students with no history,
        # or personalise the analysis using available history.
        if not checkins and not assessments:
            result = analyze_wellness_history([], [])
        else:
            result = analyze_wellness_history(
                checkins,
                assessments
            )

        if result is None:
            return jsonify({
                "error": (
                    "Unable to generate your wellness analysis "
                    "right now. Please try again."
                )
            }), 502

        # --------------------------------------------------
        # Save all AI recommendations without duplicating them
        # on every request.
        #
        # AI recommendation records are identified by having a
        # non-NULL activity_key. Assessment-only guidance records
        # retain their existing NULL activity_key.
        # --------------------------------------------------

        recommendations = result.get("recommendations", [])

        if not isinstance(recommendations, list):
            recommendations = []

        valid_recommendations = []

        allowed_categories = {
            "stress",
            "mood",
            "sleep",
            "focus",
            "self_care",
            "social_support",
        }

        allowed_activities = {
            "breathing",
            "focus_timer",
            "gratitude_journal",
            "sleep",
            "talk_to_someone",
            "movement",
            "none",
        }

        for recommendation in recommendations[:3]:
            if not isinstance(recommendation, dict):
                continue

            title = recommendation.get("title")
            category = recommendation.get("category")
            message = recommendation.get("message")
            activity = recommendation.get("activity")

            if not all(
                isinstance(value, str) and value.strip()
                for value in (title, category, message, activity)
            ):
                continue

            category = category.strip()
            activity = activity.strip()

            if category not in allowed_categories:
                category = "self_care"

            if activity not in allowed_activities:
                activity = "none"

            valid_recommendations.append({
                "title": title.strip()[:120],
                "category": category,
                "message": message.strip()[:700],
                "activity": activity,
            })

        latest_assessment = assessments[0] if assessments else None
        assessment_id = (
            latest_assessment["id"]
            if latest_assessment
            else None
        )

        # Load only AI recommendation rows belonging to this student.
        existing_rows = conn.execute(
            """
            SELECT id
            FROM interventions
            WHERE user_id = ?
              AND activity_key IS NOT NULL
            ORDER BY id ASC
            """,
            (user_id,)
        ).fetchall()

        existing_ids = [
            row["id"] for row in existing_rows
        ]

        # Update existing rows or insert new ones.
        for index, recommendation in enumerate(valid_recommendations):
            recommendation_text = (
                f"{recommendation['title']}\n\n"
                f"{recommendation['message']}"
            )

            activity_key = recommendation["activity"]
            category = recommendation["category"]

            if index < len(existing_ids):
                # Reuse an existing AI recommendation record.
                conn.execute(
                    """
                    UPDATE interventions
                    SET user_id = ?,
                        assessment_id = ?,
                        recommendation_text = ?,
                        intervention_type = ?,
                        activity_key = ?
                    WHERE id = ? AND user_id = ?
                    """,
                    (
                        user_id,
                        assessment_id,
                        recommendation_text,
                        category,
                        activity_key,
                        existing_ids[index],
                        user_id
                    )
                )
            else:
                # No existing record is available for this suggestion.
                conn.execute(
                    """
                    INSERT INTO interventions (
                        user_id,
                        assessment_id,
                        recommendation_text,
                        intervention_type,
                        activity_key
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        assessment_id,
                        recommendation_text,
                        category,
                        activity_key
                    )
                )

        # Remove surplus AI recommendation rows if the new analysis
        # contains fewer recommendations than the previous analysis.
        surplus_ids = existing_ids[len(valid_recommendations):]

        for intervention_id in surplus_ids:
            conn.execute(
                """
                DELETE FROM interventions
                WHERE id = ?
                  AND user_id = ?
                  AND activity_key IS NOT NULL
                """,
                (intervention_id, user_id)
            )

        conn.commit()

        return jsonify({
            "participant_id": participant_id,
            "analysis": result,
            "source_counts": {
                "checkins": len(checkins),
                "assessments": len(assessments)
            }
        }), 200

    except Exception:
        conn.rollback()
        app.logger.exception(
            "Failed to generate wellness analysis"
        )

        return jsonify({
            "error": (
                "Something went wrong while generating "
                "your wellness analysis. Please try again."
            )
        }), 500

    finally:
        conn.close()


# --------------------------------------------------
# GET saved AI wellness recommendations for Dashboard
# --------------------------------------------------

@app.route("/wellness-analysis/recommendations", methods=["GET"])
def get_saved_wellness_recommendations():
    participant_id = request.args.get("participant_id", "").strip()

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({
                "error": "Participant not found"
            }), 404

        rows = conn.execute(
            """
            SELECT
                recommendation_text,
                intervention_type,
                activity_key
            FROM interventions
            WHERE user_id = ?
              AND activity_key IS NOT NULL
            ORDER BY id ASC
            """,
            (user_id,)
        ).fetchall()

        recommendations = []

        for row in rows:
            activity_key = row["activity_key"]

            # Do not show recommendations without a usable activity.
            if not activity_key or activity_key == "none":
                continue

            recommendation_text = (
                row["recommendation_text"] or ""
            ).strip()

            if not recommendation_text:
                continue

            # Saved AI recommendations use:
            # Title, followed by a blank line, followed by the message.
            parts = recommendation_text.split("\n\n", 1)

            title = parts[0].strip()
            message = parts[1].strip() if len(parts) > 1 else ""

            if not title:
                continue

            recommendations.append({
                "title": title,
                "category": row["intervention_type"] or "self_care",
                "message": message,
                "activity": activity_key
            })

        return jsonify({
            "participant_id": participant_id,
            "has_recommendations": len(recommendations) > 0,
            "recommendations": recommendations
        }), 200

    except sqlite3.Error:
        app.logger.exception(
            "Could not load saved wellness recommendations"
        )

        return jsonify({
            "error": "Unable to load your wellness activities right now."
        }), 500

    finally:
        conn.close()



# --------------------------------------------------
# Resources
# --------------------------------------------------

@app.route("/resources", methods=["POST"])
def create_resource():
    data = get_request_data()

    title = data.get("title")
    category = data.get("category")
    description = data.get("description")
    contact_info = data.get("contact_info")

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "title is required"}), 400

    if not isinstance(category, str) or not category.strip():
        return jsonify({"error": "category is required"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            INSERT INTO resources
                (title, category, description, contact_info)
            VALUES (?, ?, ?, ?)
            """,
            (
                title.strip(),
                category.strip(),
                description,
                contact_info
            )
        )

        conn.commit()

        return jsonify({
            "id": cur.lastrowid,
            "title": title.strip(),
            "category": category.strip()
        }), 201

    finally:
        conn.close()


@app.route("/resources", methods=["GET"])
def list_resources():
    category = request.args.get("category")
    conn = get_connection()

    try:
        if category:
            rows = conn.execute(
                """
                SELECT *
                FROM resources
                WHERE category = ?
                ORDER BY title
                """,
                (category,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM resources ORDER BY title"
            ).fetchall()

        return jsonify([dict(row) for row in rows]), 200

    finally:
        conn.close()


@app.route("/resources/<int:resource_id>", methods=["GET"])
def get_resource(resource_id):
    conn = get_connection()

    try:
        row = conn.execute(
            "SELECT * FROM resources WHERE id = ?",
            (resource_id,)
        ).fetchone()

        if row is None:
            return jsonify({"error": "Resource not found"}), 404

        return jsonify(dict(row)), 200

    finally:
        conn.close()


@app.route("/resources/<int:resource_id>", methods=["PUT"])
def update_resource(resource_id):
    data = get_request_data()

    title = data.get("title")
    category = data.get("category")
    description = data.get("description")
    contact_info = data.get("contact_info")

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "title is required"}), 400

    if not isinstance(category, str) or not category.strip():
        return jsonify({"error": "category is required"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            UPDATE resources
            SET title = ?, category = ?, description = ?, contact_info = ?
            WHERE id = ?
            """,
            (
                title.strip(),
                category.strip(),
                description,
                contact_info,
                resource_id
            )
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Resource not found"}), 404

        conn.commit()

        return jsonify({
            "id": resource_id,
            "title": title.strip(),
            "category": category.strip()
        }), 200

    finally:
        conn.close()


@app.route("/resources/<int:resource_id>", methods=["DELETE"])
def delete_resource(resource_id):
    conn = get_connection()

    try:
        cur = conn.execute(
            "DELETE FROM resources WHERE id = ?",
            (resource_id,)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Resource not found"}), 404

        conn.commit()

        return jsonify({"deleted": resource_id}), 200

    finally:
        conn.close()


# --------------------------------------------------
# Wellness chat and conversation history
# --------------------------------------------------

@app.route("/wellness-chats", methods=["POST"])
def create_wellness_chat():
    data = get_request_data()

    participant_id = data.get("participant_id")
    question_text = data.get("question_text")
    conversation_id = data.get("conversation_id")

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({"error": "participant_id is required"}), 400

    participant_id = participant_id.strip()

    if not isinstance(question_text, str) or not question_text.strip():
        return jsonify({"error": "question_text is required"}), 400

    question_text = question_text.strip()

    if len(question_text) > 5000:
        return jsonify({"error": "Question is too long"}), 400

    if conversation_id is not None:
        try:
            conversation_id = int(conversation_id)
            if conversation_id <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid conversation_id"}), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        if conversation_id is not None:
            conversation = conn.execute(
                """
                SELECT id
                FROM chat_conversations
                WHERE id = ? AND user_id = ?
                """,
                (conversation_id, user_id)
            ).fetchone()

            if conversation is None:
                return jsonify({"error": "Conversation not found"}), 404

        conversation_history = []

        if conversation_id is not None:
            previous_rows = conn.execute(
                """
                SELECT question_text, response_text
                FROM wellness_chats
                WHERE conversation_id = ? AND user_id = ?
                ORDER BY id DESC
                LIMIT 6
                """,
                (conversation_id, user_id)
            ).fetchall()

            previous_rows = list(reversed(previous_rows))

            for row in previous_rows:
                conversation_history.append({
                    "role": "user",
                    "content": row["question_text"]
                })

                if row["response_text"]:
                    conversation_history.append({
                        "role": "assistant",
                        "content": row["response_text"]
                    })

        mood_rows = conn.execute(
            """
            SELECT checkin_date, mood_value, feelings, note
            FROM checkins
            WHERE user_id = ?
            ORDER BY checkin_date DESC, id DESC
            LIMIT 7
            """,
            (user_id,)
        ).fetchall()

        mood_context = [
            {
                "checkin_date": row["checkin_date"],
                "mood_value": row["mood_value"],
                "feelings": row["feelings"],
                "note": row["note"]
            }
            for row in mood_rows
        ]

        try:
            response_text = answer_wellness_question(
                question_text,
                conversation_history,
                mood_context=mood_context
            )
        except Exception:
            app.logger.exception("Wellness chat AI request failed")
            return jsonify({
                "error": (
                    "Unable to generate a response right now. "
                    "Please try again."
                )
            }), 502

        if not isinstance(response_text, str) or not response_text.strip():
            return jsonify({
                "error": (
                    "The AI returned an empty response. "
                    "Please try again."
                )
            }), 502

        response_text = response_text.strip()

        if conversation_id is None:
            title = question_text[:60]

            cur = conn.execute(
                """
                INSERT INTO chat_conversations (user_id, title)
                VALUES (?, ?)
                """,
                (user_id, title)
            )

            conversation_id = cur.lastrowid

        cur = conn.execute(
            """
            INSERT INTO wellness_chats
                (user_id, question_text, response_text, conversation_id)
            VALUES (?, ?, ?, ?)
            """,
            (
                user_id,
                question_text,
                response_text,
                conversation_id
            )
        )

        chat_id = cur.lastrowid

        conn.execute(
            """
            UPDATE chat_conversations
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (conversation_id, user_id)
        )

        conn.commit()

        return jsonify({
            "id": chat_id,
            "conversation_id": conversation_id,
            "question_text": question_text,
            "response_text": response_text
        }), 201

    except sqlite3.Error:
        conn.rollback()
        app.logger.exception("Database error while saving wellness chat")

        return jsonify({
            "error": "Unable to save your message right now."
        }), 500

    finally:
        conn.close()


@app.route("/wellness-conversations", methods=["GET"])
def get_wellness_conversations():
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        rows = conn.execute(
            """
            SELECT
                c.id,
                c.title,
                c.created_at,
                c.updated_at,
                (
                    SELECT wc.question_text
                    FROM wellness_chats wc
                    WHERE wc.conversation_id = c.id
                      AND wc.user_id = c.user_id
                    ORDER BY wc.id DESC
                    LIMIT 1
                ) AS last_question
            FROM chat_conversations c
            WHERE c.user_id = ?
            ORDER BY c.updated_at DESC, c.id DESC
            """,
            (user_id,)
        ).fetchall()

        conversations = [
            {
                "id": row["id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "last_question": row["last_question"]
            }
            for row in rows
        ]

        return jsonify(conversations), 200

    except sqlite3.Error:
        app.logger.exception("Could not load wellness conversations")

        return jsonify({
            "error": "Unable to load conversations right now."
        }), 500

    finally:
        conn.close()


@app.route("/wellness-chats", methods=["GET"])
def get_wellness_chat_history():
    participant_id = request.args.get("participant_id")
    conversation_id = request.args.get("conversation_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    try:
        conversation_id = int(conversation_id)

        if conversation_id <= 0:
            raise ValueError

    except (TypeError, ValueError):
        return jsonify({"error": "Invalid conversation_id"}), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        conversation = conn.execute(
            """
            SELECT id
            FROM chat_conversations
            WHERE id = ? AND user_id = ?
            """,
            (conversation_id, user_id)
        ).fetchone()

        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        rows = conn.execute(
            """
            SELECT id, conversation_id, question_text, response_text
            FROM wellness_chats
            WHERE conversation_id = ? AND user_id = ?
            ORDER BY id ASC
            """,
            (conversation_id, user_id)
        ).fetchall()

        messages = [
            {
                "id": row["id"],
                "conversation_id": row["conversation_id"],
                "question_text": row["question_text"],
                "response_text": row["response_text"]
            }
            for row in rows
        ]

        return jsonify(messages), 200

    except sqlite3.Error:
        app.logger.exception("Could not load wellness chat history")

        return jsonify({
            "error": "Unable to load chat history right now."
        }), 500

    finally:
        conn.close()


@app.route(
    "/wellness-conversations/<int:conversation_id>",
    methods=["DELETE"]
)
def delete_wellness_conversation(conversation_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        conversation = conn.execute(
            """
            SELECT id
            FROM chat_conversations
            WHERE id = ? AND user_id = ?
            """,
            (conversation_id, user_id)
        ).fetchone()

        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        conn.execute(
            """
            DELETE FROM wellness_chats
            WHERE conversation_id = ? AND user_id = ?
            """,
            (conversation_id, user_id)
        )

        conn.execute(
            """
            DELETE FROM chat_conversations
            WHERE id = ? AND user_id = ?
            """,
            (conversation_id, user_id)
        )

        conn.commit()

        return jsonify({
            "message": "Conversation deleted successfully."
        }), 200

    except sqlite3.Error:
        conn.rollback()
        app.logger.exception("Could not delete wellness conversation")

        return jsonify({
            "error": "Unable to delete this conversation right now."
        }), 500

    finally:
        conn.close()


# --------------------------------------------------
# Journal entries
# --------------------------------------------------

@app.route("/journal-entries", methods=["POST"])
def create_journal_entry():
    data = get_request_data()

    participant_id = data.get("participant_id")
    title = data.get("title")
    content = data.get("content")
    entry_date = data.get("entry_date")

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({"error": "participant_id is required"}), 400

    if title is not None and not isinstance(title, str):
        return jsonify({"error": "title must be text"}), 400

    if not isinstance(content, str) or not content.strip():
        return jsonify({"error": "content is required"}), 400

    title = title.strip() if title else None
    content = content.strip()

    if len(title or "") > 200:
        return jsonify({"error": "Title must be 200 characters or fewer"}), 400

    if len(content) > 20000:
        return jsonify({"error": "Journal entry is too long"}), 400

    if entry_date is not None and not _valid_date(entry_date):
        return jsonify({
            "error": "entry_date must use YYYY-MM-DD format"
        }), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        if entry_date:
            cur = conn.execute(
                """
                INSERT INTO journal_entries
                    (user_id, title, content, entry_date)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, title, content, entry_date)
            )
        else:
            cur = conn.execute(
                """
                INSERT INTO journal_entries
                    (user_id, title, content)
                VALUES (?, ?, ?)
                """,
                (user_id, title, content)
            )

        conn.commit()

        row = conn.execute(
            """
            SELECT id, title, content, entry_date,
                   created_at, updated_at
            FROM journal_entries
            WHERE id = ? AND user_id = ?
            """,
            (cur.lastrowid, user_id)
        ).fetchone()

        return jsonify(dict(row)), 201

    except sqlite3.Error:
        conn.rollback()
        app.logger.exception("Could not save journal entry")
        return jsonify({
            "error": "Unable to save the journal entry right now."
        }), 500

    finally:
        conn.close()


@app.route("/journal-entries", methods=["GET"])
def list_journal_entries():
    participant_id = request.args.get("participant_id")
    selected_date = request.args.get("entry_date")
    month = request.args.get("month")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    if selected_date and not _valid_date(selected_date):
        return jsonify({
            "error": "entry_date must use YYYY-MM-DD format"
        }), 400

    if month:
        try:
            year_text, month_text = month.split("-")
            year = int(year_text)
            month_number = int(month_text)

            if (
                len(year_text) != 4
                or len(month_text) != 2
                or year < 1
                or not 1 <= month_number <= 12
            ):
                raise ValueError

        except (ValueError, TypeError):
            return jsonify({
                "error": "month must use YYYY-MM format"
            }), 400

        if selected_date:
            return jsonify({
                "error": "Use either entry_date or month, not both"
            }), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({"error": "Participant not found"}), 404

        query = """
            SELECT id, title, content, entry_date,
                   created_at, updated_at
            FROM journal_entries
            WHERE user_id = ?
        """
        params = [user_id]

        if selected_date:
            query += " AND entry_date = ?"
            params.append(selected_date)

        elif month:
            query += " AND strftime('%Y-%m', entry_date) = ?"
            params.append(month)

        query += " ORDER BY entry_date DESC, id DESC"

        rows = conn.execute(query, params).fetchall()

        return jsonify([dict(row) for row in rows]), 200

    except sqlite3.Error:
        app.logger.exception("Could not load journal entries")
        return jsonify({
            "error": "Unable to load journal entries right now."
        }), 500

    finally:
        conn.close()


@app.route("/journal-entries/<int:entry_id>", methods=["GET"])
def get_journal_entry(entry_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        row = conn.execute(
            """
            SELECT j.id, j.title, j.content, j.entry_date,
                   j.created_at, j.updated_at
            FROM journal_entries j
            JOIN users u ON j.user_id = u.id
            WHERE j.id = ? AND u.participant_id = ?
            """,
            (entry_id, participant_id)
        ).fetchone()

        if row is None:
            return jsonify({"error": "Journal entry not found"}), 404

        return jsonify(dict(row)), 200

    except sqlite3.Error:
        app.logger.exception("Could not load journal entry")
        return jsonify({
            "error": "Unable to load this journal entry right now."
        }), 500

    finally:
        conn.close()


@app.route("/journal-entries/<int:entry_id>", methods=["PUT"])
def update_journal_entry(entry_id):
    data = get_request_data()

    participant_id = data.get("participant_id")
    title = data.get("title")
    content = data.get("content")
    entry_date = data.get("entry_date")

    if not isinstance(participant_id, str) or not participant_id.strip():
        return jsonify({"error": "participant_id is required"}), 400

    if title is not None and not isinstance(title, str):
        return jsonify({"error": "title must be text"}), 400

    if not isinstance(content, str) or not content.strip():
        return jsonify({"error": "content is required"}), 400

    if not isinstance(entry_date, str) or not _valid_date(entry_date):
        return jsonify({
            "error": "entry_date must use YYYY-MM-DD format"
        }), 400

    title = title.strip() if title else None
    content = content.strip()

    if len(title or "") > 200:
        return jsonify({"error": "Title must be 200 characters or fewer"}), 400

    if len(content) > 20000:
        return jsonify({"error": "Journal entry is too long"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            UPDATE journal_entries
            SET title = ?,
                content = ?,
                entry_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND user_id = (
                  SELECT id FROM users WHERE participant_id = ?
              )
            """,
            (title, content, entry_date, entry_id, participant_id)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Journal entry not found"}), 404

        conn.commit()

        row = conn.execute(
            """
            SELECT id, title, content, entry_date,
                   created_at, updated_at
            FROM journal_entries
            WHERE id = ?
            """,
            (entry_id,)
        ).fetchone()

        return jsonify(dict(row)), 200

    except sqlite3.Error:
        conn.rollback()
        app.logger.exception("Could not update journal entry")
        return jsonify({
            "error": "Unable to update the journal entry right now."
        }), 500

    finally:
        conn.close()


@app.route("/journal-entries/<int:entry_id>", methods=["DELETE"])
def delete_journal_entry(entry_id):
    participant_id = request.args.get("participant_id")

    if not participant_id:
        return jsonify({"error": "participant_id is required"}), 400

    conn = get_connection()

    try:
        cur = conn.execute(
            """
            DELETE FROM journal_entries
            WHERE id = ?
              AND user_id = (
                  SELECT id FROM users WHERE participant_id = ?
              )
            """,
            (entry_id, participant_id)
        )

        if cur.rowcount == 0:
            return jsonify({"error": "Journal entry not found"}), 404

        conn.commit()

        return jsonify({
            "deleted": entry_id,
            "message": "Journal entry deleted successfully."
        }), 200

    except sqlite3.Error:
        conn.rollback()
        app.logger.exception("Could not delete journal entry")
        return jsonify({
            "error": "Unable to delete the journal entry right now."
        }), 500

    finally:
        conn.close()


# --------------------------------------------------
# PERSONALIZED GUIDANCE RECOMMENDATIONS
# Existing rule-based endpoint retained unchanged.
# --------------------------------------------------

@app.route("/guidance/recommendations", methods=["GET"])
def get_guidance_recommendations():
    participant_id = request.args.get("participant_id", "").strip()

    if not participant_id:
        return jsonify({
            "error": "participant_id is required"
        }), 400

    conn = get_connection()

    try:
        user_id = _get_user(conn.cursor(), participant_id)

        if user_id is None:
            return jsonify({
                "error": "Participant not found"
            }), 404

        checkin = conn.execute(
            """
            SELECT mood_value, feelings, note, checkin_date
            FROM checkins
            WHERE user_id = ?
            ORDER BY checkin_date DESC, id DESC
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        assessment = conn.execute(
            """
            SELECT
                a.id,
                a.text_input,
                a.emotional_label,
                a.submitted_at,
                i.recommendation_text
            FROM assessments a
            LEFT JOIN interventions i
                ON i.id = (
                    SELECT i2.id
                    FROM interventions i2
                    WHERE i2.assessment_id = a.id
                    ORDER BY i2.created_at DESC, i2.id DESC
                    LIMIT 1
                )
            WHERE a.user_id = ?
            ORDER BY a.submitted_at DESC, a.id DESC
            LIMIT 1
            """,
            (user_id,)
        ).fetchone()

        mood = ""
        feelings = []
        checkin_note = ""
        checkin_date = None

        if checkin:
            mood = str(
                checkin["mood_value"] or ""
            ).strip().lower()

            checkin_note = str(
                checkin["note"] or ""
            ).strip()

            checkin_date = checkin["checkin_date"]

            try:
                decoded = json.loads(
                    checkin["feelings"] or "[]"
                )

                if isinstance(decoded, list):
                    feelings = [
                        item.strip().lower()
                        for item in decoded
                        if isinstance(item, str) and item.strip()
                    ]

            except (json.JSONDecodeError, TypeError):
                feelings = []

        ai_emotion = ""
        ai_guidance = ""
        assessment_date = None
        assessment_id = None
        assessment_text = ""

        if assessment:
            ai_emotion = str(
                assessment["emotional_label"] or ""
            ).strip()

            ai_guidance = str(
                assessment["recommendation_text"] or ""
            ).strip()

            assessment_date = assessment["submitted_at"]
            assessment_id = assessment["id"]

            assessment_text = str(
                assessment["text_input"] or ""
            ).strip()

        has_checkin = checkin is not None
        has_assessment = assessment is not None

        if not has_checkin and not has_assessment:
            return jsonify({
                "has_checkin": False,
                "has_assessment": False,
                "has_recommendation": False,
                "title": None,
                "category": None,
                "message": None,
                "based_on": [],
                "mood": None,
                "feelings": [],
                "checkin_note": "",
                "checkin_date": None,
                "ai_emotion": None,
                "ai_guidance": None,
                "assessment_id": None,
                "assessment_date": None,
                "activities": []
            }), 200

        combined_emotions = set(feelings)

        if ai_emotion:
            combined_emotions.add(ai_emotion.lower())

        assessment_text_lower = assessment_text.lower()

        study_keywords = (
            "assignment", "assignments",
            "exam", "exams",
            "deadline", "deadlines",
            "study", "studying",
            "concentrate", "concentration",
            "coursework"
        )

        study_pressure = any(
            keyword in assessment_text_lower
            for keyword in study_keywords
        )

        stress_emotions = {
            "anxious", "anxiety", "stressed", "stress",
            "overwhelmed", "worried", "nervous"
        }

        tired_emotions = {
            "tired", "exhausted", "drained", "fatigued"
        }

        lonely_emotions = {
            "lonely", "alone", "isolated"
        }

        if mood in {"awful", "not great"}:
            title = "Take things one step at a time."
            category = "Gentle support"
            message = (
                "You may be having a difficult day. "
                "Try one manageable step, and consider "
                "talking to someone you trust if you need support."
            )

            activities = [
                {
                    "title": "Breathing Exercise",
                    "route": "BreathingExercise"
                },
                {
                    "title": "Talk Things Through",
                    "route": "AIChat"
                }
            ]

        elif combined_emotions.intersection(stress_emotions):
            title = "Give yourself room to breathe."
            category = "Managing stress"
            message = (
                "You do not have to handle everything at once. "
                "Try slowing down before choosing one manageable task."
            )

            activities = [
                {
                    "title": "Breathing Exercise",
                    "route": "BreathingExercise"
                },
                {
                    "title": "Focus Timer",
                    "route": "FocusTimer"
                }
            ]

        elif study_pressure:
            title = "Make your workload feel more manageable."
            category = "Study and concentration"
            message = (
                "Choose one study task, break it into a smaller "
                "step, and take short breaks when needed."
            )

            activities = [
                {
                    "title": "Focus Timer",
                    "route": "FocusTimer"
                },
                {
                    "title": "Breathing Exercise",
                    "route": "BreathingExercise"
                }
            ]

        elif combined_emotions.intersection(tired_emotions):
            title = "It's okay to slow down."
            category = "Rest and recharge"
            message = (
                "Consider taking a break and giving yourself "
                "time to rest before tackling another task."
            )

            activities = [
                {
                    "title": "Sleep Better",
                    "route": "SleepBetter"
                },
                {
                    "title": "Breathing Exercise",
                    "route": "BreathingExercise"
                }
            ]

        elif combined_emotions.intersection(lonely_emotions):
            title = "You don't have to do everything alone."
            category = "Connection and support"
            message = (
                "Consider reaching out to someone you trust. "
                "You can take things at your own pace."
            )

            activities = [
                {
                    "title": "Talk Things Through",
                    "route": "AIChat"
                },
                {
                    "title": "Gratitude Journal",
                    "route": "GratitudeJournal"
                }
            ]

        elif "calm" in combined_emotions:
            title = "Make space for what helps you feel calm."
            category = "Maintaining balance"
            message = (
                "Notice what is helping you feel settled. "
                "You could reflect on your progress or plan one task."
            )

            activities = [
                {
                    "title": "Gratitude Journal",
                    "route": "GratitudeJournal"
                },
                {
                    "title": "Focus Timer",
                    "route": "FocusTimer"
                }
            ]

        elif (
            "motivated" in combined_emotions
            or mood in {"good", "amazing"}
        ):
            title = "Build on your positive momentum."
            category = "Personal growth"
            message = (
                "Choose one realistic goal and take a small step "
                "towards it. Remember to make time for breaks."
            )

            activities = [
                {
                    "title": "Focus Timer",
                    "route": "FocusTimer"
                },
                {
                    "title": "Gratitude Journal",
                    "route": "GratitudeJournal"
                }
            ]

        else:
            title = "Find your balance."
            category = "Everyday wellbeing"
            message = (
                "Check in with yourself and choose a small "
                "activity that feels helpful today."
            )

            activities = [
                {
                    "title": "Breathing Exercise",
                    "route": "BreathingExercise"
                },
                {
                    "title": "Gratitude Journal",
                    "route": "GratitudeJournal"
                }
            ]

        based_on = []

        if has_checkin:
            based_on.append("Mood check-in")

        if has_assessment:
            based_on.append("AI assessment")

        return jsonify({
            "has_checkin": has_checkin,
            "has_assessment": has_assessment,
            "has_recommendation": True,
            "title": title,
            "category": category,
            "message": message,
            "based_on": based_on,
            "mood": checkin["mood_value"] if checkin else None,
            "feelings": feelings,
            "checkin_note": checkin_note,
            "checkin_date": checkin_date,
            "ai_emotion": ai_emotion or None,
            "ai_guidance": ai_guidance or None,
            "assessment_id": assessment_id,
            "assessment_date": assessment_date,
            "activities": activities
        }), 200

    except sqlite3.Error:
        app.logger.exception(
            "Could not load personalised guidance"
        )

        return jsonify({
            "error": "Unable to load guidance right now."
        }), 500

    finally:
        conn.close()


# --------------------------------------------------
# Start development server
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        debug=False,
        host="0.0.0.0",
        port=5000
    )