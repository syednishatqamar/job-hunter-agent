import json
import sqlite3

import pandas as pd
import streamlit as st

st.set_page_config(page_title="Job Hunter Agent", page_icon="🎯", layout="wide")
st.title("🎯 Job Hunter Agent")


@st.cache_data(ttl=10)
def load_jobs():
    db = sqlite3.connect("jobs.db")
    try:
        rows = db.execute(
            "SELECT source, title, company, url, data FROM job_scores"
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []
    finally:
        db.close()

    out = []
    for source, title, company, url, data in rows:
        d = json.loads(data)
        out.append(
            {
                "Score": d["fit_score"],
                "Title": title,
                "Company": company,
                "Source": source,
                "Matched": ", ".join(d["matched_skills"]),
                "Missing": ", ".join(d["missing_skills"]),
                "Red flags": ", ".join(d["red_flags"]),
                "Why": d["reasoning"],
                "Link": url,
            }
        )
    return pd.DataFrame(out)


df = load_jobs()
if df.empty:
    st.info("No scored jobs yet. Run `python rank.py` first.")
    st.stop()

df = df.sort_values("Score", ascending=False)

# Sidebar filters
st.sidebar.header("Filters")
min_score = st.sidebar.slider("Minimum score", 0, 100, 50)
sources = st.sidebar.multiselect(
    "Sources", sorted(df["Source"].unique()), default=sorted(df["Source"].unique())
)
search = st.sidebar.text_input("Search title or company")

view = df[(df["Score"] >= min_score) & (df["Source"].isin(sources))]
if search:
    mask = view["Title"].str.contains(search, case=False, na=False) | view[
        "Company"
    ].str.contains(search, case=False, na=False)
    view = view[mask]

# Metrics
c1, c2, c3 = st.columns(3)
c1.metric("Jobs scored", len(df))
c2.metric("Average score", round(df["Score"].mean()))
c3.metric("Strong matches (70+)", int((df["Score"] >= 70).sum()))

# Table
st.subheader(f"{len(view)} jobs shown")
st.dataframe(
    view[["Score", "Title", "Company", "Source", "Link"]],
    column_config={
        "Score": st.column_config.ProgressColumn(
            "Score", min_value=0, max_value=100, format="%d"
        ),
        "Link": st.column_config.LinkColumn("Link", display_text="Open"),
    },
    hide_index=True,
)

# Detail view
if not view.empty:
    st.subheader("Job details")
    pick = st.selectbox(
        "Pick a job",
        view.index,
        format_func=lambda i: f'{view.loc[i, "Score"]} | {view.loc[i, "Title"]} - {view.loc[i, "Company"]}',
    )
    row = view.loc[pick]
    left, right = st.columns(2)
    with left:
        st.markdown(f"**Score:** {row['Score']} / 100")
        st.markdown(f"**Matched skills:** {row['Matched'] or 'none'}")
        st.markdown(f"**Missing skills:** {row['Missing'] or 'none'}")
    with right:
        st.markdown(f"**Red flags:** {row['Red flags'] or 'none'}")
        st.markdown(f"**Why:** {row['Why']}")
        st.markdown(f"[Open job posting]({row['Link']})  ·  Source: {row['Source']}")