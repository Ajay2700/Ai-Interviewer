QUESTION_PROMPT_TEMPLATE = """
You are a senior {role} interviewer.

Generate one challenging, realistic technical interview question for this role.

- Focus on real-world problem-solving and system design or coding concepts.
- The question should be concise, but non-trivial.
- Do NOT include the answer.
- Return ONLY the question text, no extra commentary.
"""


EVALUATION_PROMPT = """
Act as a strict senior technical interviewer.

Rules:
- Do NOT assume missing information.
- Do NOT hallucinate.
- Evaluate ONLY from the candidate answer and interview question provided.
- If answer is unclear, reduce score.
- If answer is incomplete, penalize heavily.
- If answer is generic, mark as weak.
- Evaluate strictly like FAANG interviews.

Interview question:
\"\"\"{question}\"\"\"

Candidate's answer:
\"\"\"{answer}\"\"\"

Return ONLY valid JSON:
{{
  "score": number (0-10),
  "confidence": number (0-100),
  "strengths": [string],
  "weaknesses": [string],
  "improvements": [string],
  "verdict": "pass" | "fail",
  "feedback": "detailed explanation"
}}

If answer is irrelevant:
- score = 0
- verdict = "fail"

Scoring guidance:
- 0-3: weak, incorrect, vague, or irrelevant
- 4-6: partially correct but missing depth/precision
- 7-8: solid and mostly complete with minor gaps
- 9-10: highly accurate, complete, and clear
"""


CONVERSATION_FOLLOWUP_PROMPT = """
You are running a structured technical interview for a {role}.

You have the following interview history so far (each entry is a question and what the candidate answered, plus an optional score):

{history}

The candidate just answered the most recent question. Based on the full conversation so far, generate the next interview question that:
- naturally follows from the candidate's previous answers
- explores a new angle or goes deeper into their decisions
- stays within the scope of the same role ({role})

Constraints:
- Ask exactly ONE clear question.
- The question must stand on its own without referencing this prompt.
- Do NOT include the answer.
- Return ONLY the question text, with no extra commentary.
"""


