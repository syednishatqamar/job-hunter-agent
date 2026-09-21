import os
import time
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

candidates = [
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.1-flash-lite",
    "models/gemini-3.5-flash",
    "models/gemini-3.7-flash",
    "models/gemini-3.8-flash",
]

for m in candidates:
    try:
        r = client.models.generate_content(model=m, contents="Say hello")
        print("WORKS  :", m)
    except Exception as e:
        msg = str(e)
        if "429" in msg:
            print("NO QUOTA:", m)
        else:
            print("ERROR  :", m, "-", msg[:120])
    time.sleep(3)