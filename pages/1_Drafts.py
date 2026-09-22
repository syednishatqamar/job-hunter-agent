import json
import sqlite3

import streamlit as st

st.set_page_config(page_title="Drafts", layout="wide")
st.title(" Proposal Drafts")

db = sqlite3.connect("jobs.db")
db.execute(
    "CREATE TABLE IF NOT EXISTS drafts "
    "(job_id TEXT PRIMARY KEY, title TEXT, company TEXT, draft TEXT, review TEXT, status TEXT)"
)
db.commit()

rows = db.execute(
    "SELECT job_id, title, company, draft, review, status FROM drafts "
    "WHERE status = 'pending'"
).fetchall()

if not rows:
    st.info("No pending drafts. Run `python drafter.py` in the terminal to create one.")
else:
    st.write(f"{len(rows)} draft(s) waiting for your review.")

    for job_id, title, company, draft, review_json, status in rows:
        review = json.loads(review_json)
        with st.expander(f"{title} — {company}", expanded=True):
            if review.get("unsupported_claims"):
                st.warning("Critic flagged possible unsupported claims: " + ", ".join(review["unsupported_claims"]))
            if review.get("generic_phrases"):
                st.caption("Generic phrases flagged: " + ", ".join(review["generic_phrases"]))

            edited = st.text_area(
                "Draft (edit before approving if needed)",
                value=draft,
                height=200,
                key=f"text_{job_id}",
            )

            c1, c2, c3 = st.columns([1, 1, 4])
            approve = c1.button("✅ Approve", key=f"approve_{job_id}")
            reject = c2.button("❌ Reject", key=f"reject_{job_id}")

            if approve:
                db.execute(
                    "UPDATE drafts SET draft = ?, status = 'approved' WHERE job_id = ?",
                    (edited, job_id),
                )
                db.commit()
                st.success("Approved. This draft is now cleared for you to send manually.")
                st.rerun()

            if reject:
                db.execute(
                    "UPDATE drafts SET status = 'rejected' WHERE job_id = ?",
                    (job_id,),
                )
                db.commit()
                st.info("Rejected.")
                st.rerun()

st.divider()
st.subheader("Approved (cleared to send)")
approved = db.execute(
    "SELECT title, company, draft FROM drafts WHERE status = 'approved'"
).fetchall()
if approved:
    for title, company, draft in approved:
        with st.expander(f"{title} — {company}"):
            st.text(draft)
else:
    st.caption("None yet.")

st.subheader("Rejected")
rejected = db.execute(
    "SELECT title, company FROM drafts WHERE status = 'rejected'"
).fetchall()
if rejected:
    for title, company in rejected:
        st.caption(f"• {title} — {company}")
else:
    st.caption("None yet.")