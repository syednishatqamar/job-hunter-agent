from flask import Flask, request, jsonify

from core import (
    extract_resume_text,
    fetch_jobs,
    score_jobs,
    draft_with_critic,
    recommend_courses,
    course_search_url,
    relative_time,
)

app = Flask(__name__, static_folder="web", static_url_path="")

SESSION = {"resume_text": "", "jobs_by_id": {}}


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/drafts")
def drafts_page():
    return app.send_static_file("drafts.html")


@app.route("/api/search", methods=["POST"])
def api_search():
    cv = request.files.get("cv")
    role = request.form.get("role", "").strip()
    location = request.form.get("location", "").strip()

    if not cv or not role:
        return jsonify({"error": "A CV and a target role are both required."}), 400

    try:
        resume_text = extract_resume_text(cv.filename, cv.read())
    except Exception:
        return jsonify({"error": "Could not read that file. Try a PDF, DOCX, TXT, or MD file."}), 400

    SESSION["resume_text"] = resume_text

    jobs, keywords = fetch_jobs(role)
    if not jobs:
        return jsonify({"jobs": [], "courses": [], "keywords": keywords})

    try:
        results = score_jobs(resume_text, role, location, jobs, max_new=15)
    except Exception as e:
        return jsonify({"error": f"Scoring failed: {str(e)[:200]}"}), 500

    out_jobs = []
    for job, score in results:
        SESSION["jobs_by_id"][job["id"]] = job
        job_out = dict(job)
        job_out["posted_relative"] = relative_time(job.get("posted_raw"))
        out_jobs.append({"job": job_out, "score": score.model_dump()})

    try:
        courses = recommend_courses(resume_text, role)
    except Exception:
        courses = []
    out_courses = [{**c.model_dump(), "search_url": course_search_url(c)} for c in courses]

    return jsonify({"jobs": out_jobs, "courses": out_courses, "keywords": keywords})


@app.route("/api/draft", methods=["POST"])
def api_draft():
    data = request.get_json(silent=True) or {}
    job_id = data.get("job_id")
    job = SESSION["jobs_by_id"].get(job_id)

    if not job:
        return jsonify({"error": "That job is no longer in this session. Please search again."}), 400
    if not SESSION["resume_text"]:
        return jsonify({"error": "No CV on file for this session. Please search again."}), 400

    try:
        draft, review = draft_with_critic(SESSION["resume_text"], job)
    except Exception as e:
        return jsonify({"error": f"Drafting failed: {str(e)[:200]}"}), 500

    return jsonify({"draft": draft, "review": review.model_dump()})


if __name__ == "__main__":
    app.run(debug=True, port=5000)